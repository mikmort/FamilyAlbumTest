const { execute, query } = require('../shared/db');
const { uploadBlob, deleteBlob } = require('../shared/storage');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { Readable } = require('stream');

ffmpeg.setFfmpegPath(ffmpegPath);

// Version: 2.1 - Added midsize image generation for files >1MB
/**
 * Check if filename exists and generate Windows-style duplicate name if needed
 * E.g., IMG_5033.jpg -> IMG_5033 (1).jpg -> IMG_5033 (2).jpg
 * Note: Uses exact match queries only - no wildcards for performance
 */
async function getUniqueFilename(originalFilename) {
    const fileExt = originalFilename.substring(originalFilename.lastIndexOf('.'));
    const fileNameWithoutExt = originalFilename.substring(0, originalFilename.lastIndexOf('.'));
    
    // Check if the exact original filename exists
    const exactCheckQuery = `
        SELECT PFileName 
        FROM dbo.Pictures 
        WHERE PFileName = @filename
    `;
    
    const existingExact = await query(exactCheckQuery, { 
        filename: originalFilename
    });
    
    // If no duplicate, return original filename
    if (!existingExact || existingExact.length === 0) {
        return originalFilename;
    }
    
    // Original exists, need to find numbered version
    // Check numbered versions one by one (no wildcards)
    const existingNumbers = new Set([0]); // 0 represents the base filename
    let counter = 1;
    let foundGap = false;
    
    // Check sequentially for numbered versions: (1), (2), (3), etc.
    // Stop when we find a gap (missing number)
    while (!foundGap && counter < 1000) { // Safety limit of 1000
        const numberedFilename = `${fileNameWithoutExt} (${counter})${fileExt}`;
        const numberedCheckQuery = `
            SELECT PFileName 
            FROM dbo.Pictures 
            WHERE PFileName = @filename
        `;
        
        const numberedExists = await query(numberedCheckQuery, { 
            filename: numberedFilename
        });
        
        if (numberedExists && numberedExists.length > 0) {
            existingNumbers.add(counter);
            counter++;
        } else {
            // Found a gap - this number is available
            foundGap = true;
            return numberedFilename;
        }
    }
    
    // Safety fallback (shouldn't reach here)
    return `${fileNameWithoutExt} (${counter})${fileExt}`;
}

module.exports = async function (context, req) {
    context.log('Upload API function processed a request.');
    context.log('Content-Type:', req.headers['content-type']);
    context.log('Body type:', typeof req.body);
    context.log('Body is Buffer?', Buffer.isBuffer(req.body));

    try {
        // Handle both multipart/form-data and JSON (base64) uploads
        let fileName, buffer, contentType;

        if (req.headers['content-type']?.includes('multipart/form-data')) {
            context.log('Processing multipart/form-data upload');
            
            // Parse multipart form data manually (simple implementation)
            const contentTypeHeader = req.headers['content-type'];
            const boundary = contentTypeHeader.split('boundary=')[1];
            
            if (!boundary) {
                context.log.error('No boundary found in Content-Type header');
                context.res = {
                    status: 400,
                    body: { error: 'Invalid multipart request - no boundary found' }
                };
                return;
            }

            context.log('Boundary:', boundary);

            // Parse the raw body
            let bodyBuffer;
            try {
                if (Buffer.isBuffer(req.body)) {
                    bodyBuffer = req.body;
                } else if (typeof req.body === 'string') {
                    bodyBuffer = Buffer.from(req.body, 'binary');
                } else if (req.body && typeof req.body === 'object') {
                    // Azure Functions sometimes provides the body as an object
                    // Try to access the raw body buffer
                    bodyBuffer = req.rawBody ? Buffer.from(req.rawBody, 'binary') : Buffer.from(JSON.stringify(req.body));
                } else {
                    throw new Error(`Unexpected body type: ${typeof req.body}`);
                }
                
                context.log('Body buffer size:', bodyBuffer.length);
            } catch (bufferError) {
                context.log.error('Error creating body buffer:', bufferError);
                throw new Error(`Failed to parse request body: ${bufferError.message}`);
            }

            const bodyStr = bodyBuffer.toString('binary');
            const parts = bodyStr.split(`--${boundary}`);
            
            context.log('Number of parts:', parts.length);
            
            for (const part of parts) {
                if (part.includes('Content-Disposition') && part.includes('filename=')) {
                    // Extract filename
                    const filenameMatch = part.match(/filename="([^"]+)"/);
                    if (filenameMatch) {
                        fileName = filenameMatch[1];
                        context.log('Extracted filename:', fileName);
                    }
                    
                    // Extract content type
                    const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);
                    if (contentTypeMatch) {
                        contentType = contentTypeMatch[1].trim();
                        context.log('Extracted content type:', contentType);
                    }
                    
                    // Extract binary data (everything after the headers)
                    const dataStart = part.indexOf('\r\n\r\n') + 4;
                    const dataEnd = part.lastIndexOf('\r\n');
                    if (dataStart > 3 && dataEnd > dataStart) {
                        const binaryData = part.substring(dataStart, dataEnd);
                        buffer = Buffer.from(binaryData, 'binary');
                        context.log('Extracted buffer size:', buffer.length);
                    }
                    break;
                }
            }
        } else {
            // Handle JSON with base64 data (legacy support)
            const { fileName: jsonFileName, fileData, contentType: jsonContentType } = req.body;

            if (!jsonFileName || !fileData) {
                context.res = {
                    status: 400,
                    body: { error: 'File name and data are required' }
                };
                return;
            }

            fileName = jsonFileName;
            buffer = Buffer.from(fileData, 'base64');
            contentType = jsonContentType;
        }

        if (!fileName || !buffer) {
            context.log.error('Missing required data:', { 
                hasFileName: !!fileName, 
                hasBuffer: !!buffer,
                bufferSize: buffer ? buffer.length : 0,
                fileName: fileName || 'missing'
            });
            context.res = {
                status: 400,
                body: { 
                    error: 'File name and data are required',
                    details: {
                        fileName: fileName || 'missing',
                        bufferReceived: !!buffer,
                        bufferSize: buffer ? buffer.length : 0
                    }
                }
            };
            return;
        }

        // Validate file type
        if (!contentType || (!contentType.startsWith('image/') && !contentType.startsWith('video/'))) {
            context.res = {
                status: 400,
                body: { error: 'Only image and video files are allowed' }
            };
            return;
        }

        // Check filename for HEIC FIRST, before Sharp detection
        const lowerFileName = fileName.toLowerCase();
        const isHeicByFilename = lowerFileName.endsWith('.heic') || lowerFileName.endsWith('.heif');
        
        context.log(`Initial filename check: ${fileName}, isHEIC: ${isHeicByFilename}`);

        // Detect actual file type from buffer (in case of misidentification)
        let actualContentType = contentType;
        
        // Try to detect format for all files, not just those marked as images
        // This helps identify HEIC files that browsers might send with wrong MIME type
        try {
            const metadata = await sharp(buffer).metadata();
            // Map sharp format to MIME type
            const formatMap = {
                'jpeg': 'image/jpeg',
                'jpg': 'image/jpeg',
                'png': 'image/png',
                'webp': 'image/webp',
                'gif': 'image/gif',
                'tiff': 'image/tiff',
                'heic': 'image/heic',
                'heif': 'image/heif'
            };
            if (metadata.format && formatMap[metadata.format]) {
                actualContentType = formatMap[metadata.format];
                context.log(`Detected actual format: ${metadata.format}, MIME: ${actualContentType}`);
            }
        } catch (err) {
            context.log('Could not detect image format with Sharp, using original content type');
            // If Sharp can't read it, it might be a video - keep original content type
        }
        
        // Override actualContentType if filename indicates HEIC
        if (isHeicByFilename) {
            actualContentType = 'image/heic';
            context.log(`Filename ends with .heic/.heif - forcing actualContentType to image/heic`);
        }

        context.log(`File: ${fileName}, ContentType: ${contentType}, ActualContentType: ${actualContentType}`);

        // Convert HEIC files to JPG - do this BEFORE checking for duplicates
        let needsHeicConversion = false;
        let fileNameToCheck = fileName;
        
        if (lowerFileName.endsWith('.heic') || lowerFileName.endsWith('.heif') || 
            actualContentType === 'image/heic' || actualContentType === 'image/heif') {
            needsHeicConversion = true;
            // Change extension to .jpg
            const lastDotIndex = fileName.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                fileNameToCheck = fileName.substring(0, lastDotIndex) + '.jpg';
            }
            actualContentType = 'image/jpeg';
            context.log(`✅ HEIC file detected. Converting to JPG: ${fileName} -> ${fileNameToCheck}`);
            context.log(`   Lower filename: ${lowerFileName}`);
            context.log(`   actualContentType: ${actualContentType}`);
        } else {
            context.log(`ℹ️ Not a HEIC file. Extension: ${lowerFileName.endsWith('.heic') || lowerFileName.endsWith('.heif')}, ContentType: ${actualContentType}`);
        }
        
        // Convert AVI files to MP4 - do this BEFORE checking for duplicates
        let needsVideoConversion = false;
        if (lowerFileName.endsWith('.avi') || 
            actualContentType === 'video/x-msvideo' || 
            actualContentType === 'video/avi' ||
            actualContentType === 'video/msvideo') {
            needsVideoConversion = true;
            // Change extension to .mp4 (handle both uppercase and lowercase)
            // Find the last occurrence of .avi (case insensitive) and replace with .mp4
            const lastDotIndex = fileName.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                fileNameToCheck = fileName.substring(0, lastDotIndex) + '.mp4';
            }
            actualContentType = 'video/mp4';
            context.log(`✅ AVI file detected. Will convert to MP4: ${fileName} -> ${fileNameToCheck}`);
        } else {
            context.log(`ℹ️ Not an AVI file. Extension check: ${lowerFileName.endsWith('.avi')}, ContentType: ${actualContentType}`);
        }

        // Check for duplicate filenames and generate Windows-style numbered name if needed
        // E.g., IMG_5033.jpg -> IMG_5033 (1).jpg -> IMG_5033 (2).jpg
        let uniqueFilename = await getUniqueFilename(fileNameToCheck);
        
        if (uniqueFilename !== fileNameToCheck) {
            context.log(`Duplicate detected. Renamed: ${fileNameToCheck} -> ${uniqueFilename}`);
        }
        
        const mediaType = actualContentType.startsWith('image/') ? 1 : 2; // 1=image, 2=video

        let thumbnailUrl = null;
        let midsizeUrl = null; // NEW: midsize image URL
        let blobUrl = null;
        let width = 0;
        let height = 0;
        let duration = 0;

        // Process images: fix orientation, create thumbnail, and create midsize if >1MB
        if (mediaType === 1) {
            try {
                // First, check original metadata to log orientation
                const originalMetadata = await sharp(buffer).metadata();
                context.log(`Original image EXIF orientation: ${originalMetadata.orientation || 'none'}, dimensions: ${originalMetadata.width}x${originalMetadata.height}`);
                
                const originalSizeMB = buffer.length / (1024 * 1024);
                context.log(`Original image size: ${originalSizeMB.toFixed(2)} MB`);

                // Create the full-size rotated image using a two-step process
                // Step 1: Rotate based on EXIF orientation - use explicit approach
                // For HEIC files, ALWAYS process even if no rotation needed (to convert format)
                let rotatedOnce;
                const needsFormatConversion = originalMetadata.format === 'heic' || originalMetadata.format === 'heif';
                
                if ((originalMetadata.orientation && originalMetadata.orientation !== 1) || needsFormatConversion) {
                    if (needsFormatConversion) {
                        context.log(`HEIC/HEIF detected - converting to JPEG (orientation: ${originalMetadata.orientation || 'none'})`);
                    } else {
                        context.log(`Applying rotation for EXIF orientation: ${originalMetadata.orientation}`);
                    }
                    rotatedOnce = await sharp(buffer, { failOnError: false })
                        .rotate() // Auto-rotate based on EXIF
                        .toBuffer();
                } else {
                    context.log(`No rotation needed (orientation is 1 or undefined)`);
                    rotatedOnce = buffer;
                }
                
                // Step 2: Strip ALL EXIF metadata from the rotated image
                const rotatedBuffer = await sharp(rotatedOnce)
                    .withMetadata({}) // Remove all metadata
                    .jpeg({ quality: 95, mozjpeg: true })
                    .toBuffer();

                // Get metadata from rotated image
                const metadata = await sharp(rotatedBuffer).metadata();
                width = metadata.width || 0;
                height = metadata.height || 0;

                context.log(`Full image after rotation - dimensions: ${width}x${height}, orientation: ${metadata.orientation || 'undefined'}`);

                // NEW: Create midsize version if image >1MB and dimensions >1080px
                const shouldCreateMidsize = originalSizeMB > 1 && (width > 1080 || height > 1080);
                if (shouldCreateMidsize) {
                    context.log(`Creating midsize version (image >1MB and dimensions >1080px)`);
                    
                    const midsizeBuffer = await sharp(rotatedBuffer)
                        .resize(1080, 1080, {
                            fit: 'inside',
                            withoutEnlargement: true
                        })
                        .jpeg({ quality: 85, mozjpeg: true })
                        .toBuffer();
                    
                    const midsizeMetadata = await sharp(midsizeBuffer).metadata();
                    const midsizeSizeMB = midsizeBuffer.length / (1024 * 1024);
                    context.log(`Midsize image created - dimensions: ${midsizeMetadata.width}x${midsizeMetadata.height}, size: ${midsizeSizeMB.toFixed(2)} MB`);
                    
                    // Prepare midsize filename
                    const fileExt = uniqueFilename.substring(uniqueFilename.lastIndexOf('.'));
                    const midsizeFilename = `${uniqueFilename.substring(0, uniqueFilename.lastIndexOf('.'))}-midsize${fileExt}`;
                    const midsizeBlobPath = `media/${midsizeFilename}`;
                    
                    // Upload midsize
                    context.log(`Uploading midsize as: ${midsizeFilename}`);
                    midsizeUrl = await uploadBlob(
                        midsizeBlobPath,
                        midsizeBuffer,
                        'image/jpeg'
                    );
                    context.log(`✅ Midsize uploaded to: ${midsizeUrl}`);
                } else {
                    context.log(`Skipping midsize creation (size: ${originalSizeMB.toFixed(2)}MB, dimensions: ${width}x${height})`);
                }

                // Now create thumbnail - CRITICAL: rotate and resize in one operation, then strip metadata
                // If we rotate first to a buffer, then resize, Sharp might not preserve the rotation
                const thumbnailBuffer = await sharp(buffer, { failOnError: false })
                    .rotate() // Auto-rotate based on EXIF (this reads EXIF from original buffer)
                    .resize(null, 200, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .withMetadata({}) // Strip all metadata AFTER rotation and resize
                    .jpeg({ quality: 80 })
                    .toBuffer();
                
                context.log(`Thumbnail created with rotation in single operation`);

                const thumbMetadata = await sharp(thumbnailBuffer).metadata();
                context.log(`Thumbnail created from rotated buffer - dimensions: ${thumbMetadata.width}x${thumbMetadata.height}, orientation: ${thumbMetadata.orientation || 'undefined'}`);

                // Prepare thumbnail filename
                const fileExt = uniqueFilename.substring(uniqueFilename.lastIndexOf('.'));
                const thumbFilename = `thumb_${uniqueFilename.substring(0, uniqueFilename.lastIndexOf('.'))}.jpg`;
                const thumbBlobPath = `media/${thumbFilename}`;
                
                // Delete any existing thumbnail BEFORE uploading new one
                try {
                    context.log(`Attempting to delete any existing thumbnail at: ${thumbBlobPath}`);
                    await deleteBlob(thumbBlobPath);
                    context.log(`✅ Deleted existing thumbnail`);
                } catch (deleteErr) {
                    context.log(`No existing thumbnail to delete: ${deleteErr.message}`);
                }
                
                // Upload the new thumbnail
                context.log(`Uploading new thumbnail as: ${thumbFilename}`);
                thumbnailUrl = await uploadBlob(
                    thumbBlobPath,
                    thumbnailBuffer,
                    'image/jpeg'
                );
                context.log(`✅ Thumbnail uploaded to: ${thumbnailUrl}`);

                // Use rotated buffer as the main image
                buffer = rotatedBuffer;

                context.log(`Image processed and rotated: ${width}x${height}, thumbnail created and uploaded`);
            } catch (err) {
                context.log.error('Error processing image:', err);
                // Continue with original buffer if processing fails
            }
        } 
        // Process videos: convert AVI to MP4 if needed, extract thumbnail
        else if (mediaType === 2) {
            try {
                let videoBuffer = buffer;
                
                // Convert AVI to MP4 if needed
                if (needsVideoConversion) {
                    context.log('Converting AVI to MP4...');
                    videoBuffer = await new Promise((resolve, reject) => {
                        const chunks = [];
                        const inputStream = Readable.from(buffer);
                        
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
                            .on('start', (cmd) => context.log('FFmpeg command:', cmd))
                            .on('progress', (progress) => {
                                if (progress.percent) {
                                    context.log(`Conversion progress: ${progress.percent.toFixed(1)}%`);
                                }
                            })
                            .on('error', (err) => {
                                context.log.error('FFmpeg conversion error:', err);
                                reject(err);
                            })
                            .on('end', () => {
                                context.log('AVI to MP4 conversion completed');
                                resolve(Buffer.concat(chunks));
                            })
                            .pipe()
                            .on('data', (chunk) => chunks.push(chunk));
                    });
                    
                    buffer = videoBuffer; // Use converted video
                    context.log(`Converted AVI to MP4, new size: ${videoBuffer.length} bytes`);
                }
                
                // Upload video to blob storage
                blobUrl = await uploadBlob(
                    `media/${uniqueFilename}`,
                    buffer,
                    actualContentType
                );
                context.log('Video uploaded to blob storage');

                context.log('Generating video thumbnail...');
                // Generate thumbnail from video using screenshot to buffer
                const thumbnailBuffer = await new Promise((resolve, reject) => {
                    const chunks = [];
                    const inputStream = Readable.from(buffer);
                    
                    ffmpeg(inputStream)
                        .inputFormat(needsVideoConversion ? 'mp4' : fileName.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4')
                        .outputFormat('image2')
                        .outputOptions([
                            '-vframes 1',      // Extract only 1 frame
                            '-ss 00:00:01',    // Seek to 1 second
                            '-vf scale=-1:200' // Scale to height 200, maintain aspect ratio
                        ])
                        .on('start', (cmd) => context.log('FFmpeg thumbnail command:', cmd))
                        .on('error', (err) => {
                            context.log.error('FFmpeg thumbnail error:', err);
                            reject(err);
                        })
                        .on('end', () => {
                            context.log('Video thumbnail extraction completed');
                            resolve(Buffer.concat(chunks));
                        })
                        .pipe()
                        .on('data', (chunk) => chunks.push(chunk));
                });

                // Upload thumbnail
                const thumbFilename = `thumb_${uniqueFilename.substring(0, uniqueFilename.lastIndexOf('.'))}.jpg`;
                thumbnailUrl = await uploadBlob(
                    `media/${thumbFilename}`,
                    thumbnailBuffer,
                    'image/jpeg'
                );

                context.log('Video thumbnail created and uploaded');
            } catch (err) {
                context.log.error('Error generating video thumbnail:', err);
                // thumbnailUrl will remain null if thumbnail generation fails
            }
        }

        // Upload images to blob storage (videos already uploaded above)
        if (mediaType === 1) {
            blobUrl = await uploadBlob(
                `media/${uniqueFilename}`,
                buffer,
                actualContentType
            );
        }

        // Use the generated thumbnail URL or fallback to main blob URL
        if (!thumbnailUrl) {
            thumbnailUrl = blobUrl;
        }

        // Add to UnindexedFiles table for processing
        const insertQuery = `
            INSERT INTO dbo.UnindexedFiles 
                (uiFileName, uiDirectory, uiThumbUrl, uiType, uiWidth, uiHeight, uiVtime, uiStatus, uiBlobUrl)
            VALUES 
                (@fileName, @directory, @thumbUrl, @type, @width, @height, @duration, 'N', @blobUrl)
        `;

        await execute(insertQuery, {
            fileName: uniqueFilename,
            directory: '', // Not used - duplicate prevention handled by numbered filenames
            thumbUrl: thumbnailUrl,
            type: mediaType,
            width: width,
            height: height,
            duration: duration,
            blobUrl,
        });

        context.log(`Uploaded file: ${uniqueFilename}`);

        context.res = {
            status: 201,
            headers: {
                'X-Upload-Version': '2.1-MIDSIZE',
                'X-Original-Filename': fileName,
                'X-Final-Filename': uniqueFilename
            },
            body: {
                success: true,
                fileName: uniqueFilename,
                blobUrl,
                thumbnailUrl,
                midsizeUrl // NEW: include midsize URL in response
            }
        };

    } catch (error) {
        context.log.error('Upload error:', error);
        context.log.error('Error stack:', error.stack);
        context.res = {
            status: 500,
            body: { 
                error: 'Internal server error', 
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        };
    }
};
