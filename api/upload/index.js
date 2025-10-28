const { execute, query } = require('../shared/db');
const { uploadBlob } = require('../shared/storage');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { Readable } = require('stream');

ffmpeg.setFfmpegPath(ffmpegPath);

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

        // Detect actual file type from buffer (in case of misidentification)
        let actualContentType = contentType;
        if (contentType.startsWith('image/')) {
            try {
                const metadata = await sharp(buffer).metadata();
                // Map sharp format to MIME type
                const formatMap = {
                    'jpeg': 'image/jpeg',
                    'jpg': 'image/jpeg',
                    'png': 'image/png',
                    'webp': 'image/webp',
                    'gif': 'image/gif',
                    'tiff': 'image/tiff'
                };
                if (metadata.format && formatMap[metadata.format]) {
                    actualContentType = formatMap[metadata.format];
                    context.log(`Detected actual format: ${metadata.format}, MIME: ${actualContentType}`);
                }
            } catch (err) {
                context.log('Could not detect image format, using original content type');
            }
        }

        // Check for duplicate filenames and generate Windows-style numbered name if needed
        // E.g., IMG_5033.jpg -> IMG_5033 (1).jpg -> IMG_5033 (2).jpg
        let uniqueFilename = await getUniqueFilename(fileName);
        
        if (uniqueFilename !== fileName) {
            context.log(`Duplicate detected. Renamed: ${fileName} -> ${uniqueFilename}`);
        }

        // Convert AVI files to MP4
        let needsVideoConversion = false;
        if (fileName.toLowerCase().endsWith('.avi') || actualContentType === 'video/x-msvideo') {
            needsVideoConversion = true;
            // Change extension to .mp4
            uniqueFilename = uniqueFilename.replace(/\.avi$/i, '.mp4');
            actualContentType = 'video/mp4';
            context.log(`AVI file detected. Will convert to MP4: ${uniqueFilename}`);
        }
        
        const mediaType = actualContentType.startsWith('image/') ? 1 : 2; // 1=image, 2=video

        let thumbnailUrl = null;
        let width = 0;
        let height = 0;
        let duration = 0;

        // Process images: fix orientation and create thumbnail
        if (mediaType === 1) {
            try {
                // First, check original metadata to log orientation
                const originalMetadata = await sharp(buffer).metadata();
                context.log(`Original image EXIF orientation: ${originalMetadata.orientation || 'none'}, dimensions: ${originalMetadata.width}x${originalMetadata.height}`);

                // Create the full-size rotated image FIRST
                const rotatedBuffer = await sharp(buffer, { failOnError: false })
                    .rotate() // Auto-rotate based on EXIF
                    .jpeg({ quality: 95, mozjpeg: true })
                    .toBuffer();

                // Get metadata from rotated image
                const metadata = await sharp(rotatedBuffer).metadata();
                width = metadata.width || 0;
                height = metadata.height || 0;

                context.log(`Full image after rotation - dimensions: ${width}x${height}, orientation: ${metadata.orientation || 'undefined'}`);

                // Now create thumbnail FROM THE ROTATED BUFFER (not from original)
                // This way the thumbnail is created from an already-rotated image
                const thumbnailBuffer = await sharp(rotatedBuffer)
                    .resize(null, 200, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 80 })
                    .toBuffer();

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
                
                // Upload video first so we can generate thumbnail from it
                const tempVideoUrl = await uploadBlob(
                    `media/${uniqueFilename}`,
                    buffer,
                    actualContentType
                );

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

        // Upload to blob storage in the media container
        const blobUrl = await uploadBlob(
            `media/${uniqueFilename}`,
            buffer,
            actualContentType
        );

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
            body: {
                success: true,
                fileName: uniqueFilename,
                blobUrl,
                thumbnailUrl
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
