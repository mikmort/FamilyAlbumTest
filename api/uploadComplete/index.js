const { execute } = require('../shared/db');
const { getContainerClient } = require('../shared/storage');
const { checkAuthorization } = require('../shared/auth');
const { StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const sharp = require('sharp');
const exifReader = require('exif-reader');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { Readable } = require('stream');

ffmpeg.setFfmpegPath(ffmpegPath);

// Helper function to generate a read SAS token for a blob
function generateReadSasUrl(blockBlobClient, expiresInMinutes = 60) {
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000);
    
    const sasToken = generateBlobSASQueryParameters(
        {
            containerName: blockBlobClient.containerName,
            blobName: blockBlobClient.name,
            permissions: BlobSASPermissions.parse("r"), // read only
            startsOn: startsOn,
            expiresOn: expiresOn,
        },
        sharedKeyCredential
    ).toString();
    
    return `${blockBlobClient.url}?${sasToken}`;
}

module.exports = async function (context, req) {
    context.log('Upload complete notification received');

    // Check authorization - upload requires 'Full' role
    const authResult = await checkAuthorization(context, 'Full');
    
    context.log('🔐 ============ AUTH RESULT DEBUG ============');
    context.log('🔐 authResult:', JSON.stringify(authResult, null, 2));
    context.log('🔐 authResult.user:', JSON.stringify(authResult.user, null, 2));
    context.log('🔐 authResult.user?.email:', authResult.user?.email);
    context.log('🔐 ==========================================');
    
    if (!authResult.authorized) {
        context.res = {
            status: authResult.status,
            headers: { 'Content-Type': 'application/json' },
            body: { error: authResult.message }
        };
        return;
    }

    try {
        const { fileName, contentType, fileModifiedDate } = req.body;
        
        context.log('📦 Request body received:', JSON.stringify(req.body, null, 2));
        context.log('📅 fileModifiedDate value:', fileModifiedDate);
        context.log('📅 fileModifiedDate type:', typeof fileModifiedDate);

        if (!fileName) {
            context.res = {
                status: 400,
                body: { 
                    success: false,
                    error: 'fileName is required' 
                }
            };
            return;
        }

        context.log('Processing uploaded file:', fileName);
        context.log('Content type:', contentType);
        context.log('File modified date:', fileModifiedDate);

        const blobName = `media/${fileName}`;
        const containerClient = getContainerClient();
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        // Verify the blob exists
        const exists = await blockBlobClient.exists();
        if (!exists) {
            context.res = {
                status: 404,
                body: { 
                    success: false,
                    error: 'Uploaded file not found in storage' 
                }
            };
            return;
        }

        const blobUrl = blockBlobClient.url;
        let mediaType = contentType?.startsWith('image/') ? 1 : 2;

        // Check if this is an AVI file that needs conversion to MP4
        // This happens when user uploads .AVI but we changed extension to .mp4 in getUploadUrl
        const isAviConversion = fileName.toLowerCase().endsWith('.mp4') && 
                                (contentType === 'video/x-msvideo' || 
                                 contentType === 'video/avi' || 
                                 contentType === 'video/msvideo');

        if (isAviConversion) {
            context.log(`⚠️ Detected AVI file uploaded as MP4: ${fileName}. Converting...`);
            
            try {
                // Download the AVI blob
                const downloadResponse = await blockBlobClient.download();
                const chunks = [];
                for await (const chunk of downloadResponse.readableStreamBody) {
                    chunks.push(chunk);
                }
                const aviBuffer = Buffer.concat(chunks);
                context.log(`Downloaded AVI file (${aviBuffer.length} bytes)`);

                // Convert AVI to MP4 using FFmpeg
                const mp4Buffer = await new Promise((resolve, reject) => {
                    const inputStream = Readable.from(aviBuffer);
                    const chunks = [];

                    ffmpeg(inputStream)
                        .inputFormat('avi')
                        .videoCodec('libx264')
                        .audioCodec('aac')
                        .outputFormat('mp4')
                        .outputOptions([
                            '-preset fast',
                            '-crf 23',
                            '-movflags +faststart'
                        ])
                        .on('start', (cmd) => {
                            context.log('FFmpeg command:', cmd);
                        })
                        .on('progress', (progress) => {
                            if (progress.percent) {
                                context.log(`Conversion progress: ${Math.round(progress.percent)}%`);
                            }
                        })
                        .on('error', (err) => {
                            context.log.error('FFmpeg error:', err);
                            reject(err);
                        })
                        .on('end', () => {
                            context.log('✓ AVI to MP4 conversion complete');
                            resolve(Buffer.concat(chunks));
                        })
                        .pipe()
                        .on('data', (chunk) => {
                            chunks.push(chunk);
                        });
                });

                // Upload the converted MP4 back to blob storage (overwrite)
                await blockBlobClient.uploadData(mp4Buffer, {
                    blobHTTPHeaders: {
                        blobContentType: 'video/mp4'
                    }
                });
                
                context.log(`✓ Uploaded converted MP4: ${fileName} (${mp4Buffer.length} bytes)`);
                mediaType = 2; // Video
                
            } catch (conversionErr) {
                context.log.error('AVI conversion failed:', conversionErr);
                // Continue with original file - it might still play
            }
        }

        // Generate API URLs (without 'media/' prefix - it's added by blob storage lookup)
        // For new uploads without directory structure, just use the filename
        const apiUrl = `/api/media/${fileName}`;
        const apiThumbUrl = `/api/media/${fileName}?thumbnail=true`;

        let thumbnailUrl = null;
        let width = 0;
        let height = 0;
        let duration = 0;
        let dateTaken = null;
        let month = null;
        let year = null;

        // Process based on media type
        if (mediaType === 1) {
            // Image processing
            try {
                context.log('Processing image...');
                
                // Download the blob
                const downloadResponse = await blockBlobClient.download();
                const chunks = [];
                for await (const chunk of downloadResponse.readableStreamBody) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);

                // Get metadata including EXIF
                const metadata = await sharp(buffer).metadata();
                width = metadata.width || 0;
                height = metadata.height || 0;

                // Extract date from EXIF if available
                if (metadata.exif) {
                    try {
                        // Parse EXIF data using exif-reader
                        const exifData = exifReader(metadata.exif);
                        context.log('EXIF data:', JSON.stringify(exifData, null, 2));
                        
                        // Try DateTimeOriginal first (most accurate for photos)
                        let dateStr = exifData?.exif?.DateTimeOriginal || exifData?.exif?.CreateDate || exifData?.image?.DateTime;
                        
                        if (dateStr) {
                            // EXIF dates can be either a Date object or a string in format "YYYY:MM:DD HH:MM:SS"
                            if (dateStr instanceof Date) {
                                dateTaken = dateStr;
                            } else if (typeof dateStr === 'string') {
                                const dateMatch = dateStr.match(/(\d{4}):(\d{2}):(\d{2})/);
                                if (dateMatch) {
                                    const [, yearStr, monthStr, dayStr] = dateMatch;
                                    dateTaken = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));
                                }
                            }
                            
                            if (dateTaken && !isNaN(dateTaken.getTime())) {
                                month = dateTaken.getMonth() + 1;
                                year = dateTaken.getFullYear();
                                context.log(`✓ Extracted date from EXIF: ${month}/${year}`);
                            }
                        } else {
                            context.log('No date found in EXIF data');
                        }
                    } catch (exifErr) {
                        context.log('Could not parse EXIF date:', exifErr.message);
                    }
                }
                
                // Fallback to file modification date if no EXIF date found
                if ((!month || !year) && fileModifiedDate) {
                    try {
                        const modDate = new Date(fileModifiedDate);
                        if (!isNaN(modDate.getTime())) {
                            month = modDate.getMonth() + 1;
                            year = modDate.getFullYear();
                            context.log(`✓ Using file modification date as fallback: ${month}/${year}`);
                        }
                    } catch (err) {
                        context.log('Could not parse file modification date:', err.message);
                    }
                }

                context.log(`Image dimensions: ${width}x${height}`);

                // Thumbnail will be generated dynamically via API
                thumbnailUrl = apiThumbUrl;

            } catch (err) {
                context.log.error('Error processing image:', err);
                // Continue without thumbnail
                thumbnailUrl = apiUrl;
            }
        } else if (mediaType === 2) {
            // Video processing
            context.log('🎬 Starting video processing...');
            
            try {
                // Generate a read SAS URL for ffprobe to access the blob
                const blobSasUrl = generateReadSasUrl(blockBlobClient, 10); // 10 minute expiry
                context.log('✓ Generated SAS URL for video processing');
                
                // Get video metadata using ffprobe with SAS URL
                await new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(blobSasUrl, (err, metadata) => {
                        if (err) {
                            context.log.error('❌ FFprobe error:', err);
                            reject(err);
                        } else {
                            context.log('✓ Video metadata retrieved successfully');
                            context.log('Video metadata:', JSON.stringify(metadata, null, 2));
                            
                            if (metadata.format && metadata.format.duration) {
                                duration = Math.round(metadata.format.duration);
                                context.log(`Duration: ${duration}s`);
                            }
                            if (metadata.streams && metadata.streams[0]) {
                                width = metadata.streams[0].width || 0;
                                height = metadata.streams[0].height || 0;
                                context.log(`Dimensions: ${width}x${height}`);
                            }
                            
                            // Extract creation date from metadata
                            if (metadata.format && metadata.format.tags) {
                                const tags = metadata.format.tags;
                                context.log('Video tags:', JSON.stringify(tags, null, 2));
                                // Try various date fields (different formats use different tags)
                                const dateStr = tags.creation_time || tags.date || tags['com.apple.quicktime.creationdate'];
                                
                                if (dateStr) {
                                    try {
                                        dateTaken = new Date(dateStr);
                                        if (!isNaN(dateTaken.getTime())) {
                                            month = dateTaken.getMonth() + 1;
                                            year = dateTaken.getFullYear();
                                            context.log(`✓ Extracted date from video metadata: ${month}/${year}`);
                                        }
                                    } catch (dateErr) {
                                        context.log('⚠️ Could not parse video date:', dateErr.message);
                                    }
                                } else {
                                    context.log('⚠️ No date tags found in video metadata');
                                }
                            } else {
                                context.log('⚠️ No tags found in video metadata');
                            }
                            
                            context.log(`Video: ${width}x${height}, duration: ${duration}s`);
                            resolve();
                        }
                    });
                });
                
                context.log(`📅 After ffprobe: month=${month}, year=${year}`);

            } catch (err) {
                context.log.error('❌ Error during video metadata extraction:', err);
                context.log('Will attempt to use file modification date fallback');
            }
            
            // ALWAYS try to use file modification date if we don't have month/year yet
            if ((!month || !year) && fileModifiedDate) {
                context.log(`📅 No date from metadata, attempting file modification date: ${fileModifiedDate}`);
                try {
                    const modDate = new Date(fileModifiedDate);
                    context.log(`Parsed mod date:`, modDate);
                    if (!isNaN(modDate.getTime())) {
                        month = modDate.getMonth() + 1;
                        year = modDate.getFullYear();
                        context.log(`✅ SUCCESS: Using file modification date: ${month}/${year}`);
                    } else {
                        context.log(`❌ Invalid date parsed from: ${fileModifiedDate}`);
                    }
                } catch (err) {
                    context.log.error('❌ Could not parse file modification date:', err);
                }
            } else if (month && year) {
                context.log(`✓ Date already set from metadata: ${month}/${year}`);
            } else if (!fileModifiedDate) {
                context.log(`⚠️ No fileModifiedDate provided in request`);
            }

            // Thumbnail will be generated dynamically via API
            thumbnailUrl = apiThumbUrl;
        }

        // Add to UnindexedFiles table for processing
        const insertQuery = `
            INSERT INTO dbo.UnindexedFiles 
                (uiFileName, uiDirectory, uiThumbUrl, uiType, uiWidth, uiHeight, uiVtime, uiStatus, uiBlobUrl, uiMonth, uiYear, uiUploadedBy)
            VALUES 
                (@fileName, @directory, @thumbUrl, @type, @width, @height, @duration, 'N', @blobUrl, @month, @year, @uploadedBy)
        `;

        const insertParams = {
            fileName: fileName,
            directory: '',
            thumbUrl: thumbnailUrl,
            type: mediaType,
            width: width,
            height: height,
            duration: duration,
            blobUrl: apiUrl,  // Store API URL instead of direct blob URL
            month: month,
            year: year,
            uploadedBy: authResult.user?.Email || null,  // Track who uploaded (note: capital E from DB)
        };
        
        context.log('📝 ============ FINAL INSERT PARAMETERS ============');
        context.log('📝 Inserting into UnindexedFiles with params:', JSON.stringify(insertParams, null, 2));
        context.log('📝 month value:', month, 'type:', typeof month);
        context.log('📝 year value:', year, 'type:', typeof year);
        context.log('📝 uploadedBy:', authResult.user?.Email);
        context.log('📝 ================================================');

        await execute(insertQuery, insertParams);

        context.log(`File registered in database: ${fileName}`);

        context.res = {
            status: 200,
            body: {
                success: true,
                fileName: fileName,
                blobUrl: apiUrl,  // Return API URL instead of direct blob URL
                thumbnailUrl: thumbnailUrl,
                width: width,
                height: height,
                duration: duration
            }
        };

    } catch (error) {
        context.log.error('Upload complete processing error:', error);
        context.res = {
            status: 500,
            body: { 
                success: false,
                error: 'Internal server error', 
                message: error.message 
            }
        };
    }
};
