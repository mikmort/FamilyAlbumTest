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

    try {
        // Handle both multipart/form-data and JSON (base64) uploads
        let fileName, buffer, contentType;

        if (req.headers['content-type']?.includes('multipart/form-data')) {
            // Parse multipart form data manually (simple implementation)
            const contentType = req.headers['content-type'];
            const boundary = contentType.split('boundary=')[1];
            
            if (!boundary) {
                context.res = {
                    status: 400,
                    body: { error: 'Invalid multipart request' }
                };
                return;
            }

            // Parse the raw body
            const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
            const bodyStr = bodyBuffer.toString('binary');
            const parts = bodyStr.split(`--${boundary}`);
            
            for (const part of parts) {
                if (part.includes('Content-Disposition') && part.includes('filename=')) {
                    // Extract filename
                    const filenameMatch = part.match(/filename="([^"]+)"/);
                    if (filenameMatch) {
                        fileName = filenameMatch[1];
                    }
                    
                    // Extract content type
                    const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);
                    if (contentTypeMatch) {
                        contentType = contentTypeMatch[1].trim();
                    }
                    
                    // Extract binary data (everything after the headers)
                    const dataStart = part.indexOf('\r\n\r\n') + 4;
                    const dataEnd = part.lastIndexOf('\r\n');
                    if (dataStart > 3 && dataEnd > dataStart) {
                        const binaryData = part.substring(dataStart, dataEnd);
                        buffer = Buffer.from(binaryData, 'binary');
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
            context.res = {
                status: 400,
                body: { error: 'File name and data are required' }
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
        const uniqueFilename = await getUniqueFilename(fileName);
        
        if (uniqueFilename !== fileName) {
            context.log(`Duplicate detected. Renamed: ${fileName} -> ${uniqueFilename}`);
        }
        
        const mediaType = actualContentType.startsWith('image/') ? 1 : 2; // 1=image, 2=video

        let thumbnailUrl = null;
        let width = 0;
        let height = 0;
        let duration = 0;

        // Process images: fix orientation and create thumbnail
        if (mediaType === 1) {
            try {
                // Auto-rotate based on EXIF orientation and get metadata
                const image = sharp(buffer).rotate(); // rotate() with no args uses EXIF
                const metadata = await image.metadata();
                width = metadata.width || 0;
                height = metadata.height || 0;

                // Create thumbnail (200px height, maintain aspect ratio)
                const thumbnailBuffer = await image
                    .resize(null, 200, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 80 })
                    .toBuffer();

                // Upload thumbnail
                const fileExt = uniqueFilename.substring(uniqueFilename.lastIndexOf('.'));
                const thumbFilename = `thumb_${uniqueFilename.substring(0, uniqueFilename.lastIndexOf('.'))}.jpg`;
                thumbnailUrl = await uploadBlob(
                    `media/${thumbFilename}`,
                    thumbnailBuffer,
                    'image/jpeg'
                );

                // Re-encode the main image with orientation fix
                buffer = await image
                    .jpeg({ quality: 95 })
                    .toBuffer();

                context.log(`Image processed: ${width}x${height}, thumbnail created`);
            } catch (err) {
                context.log.error('Error processing image:', err);
                // Continue with original buffer if processing fails
            }
        } 
        // Process videos: extract thumbnail
        else if (mediaType === 2) {
            try {
                // Upload video first so we can generate thumbnail from it
                const tempVideoUrl = await uploadBlob(
                    `media/${uniqueFilename}`,
                    buffer,
                    actualContentType
                );

                // Generate thumbnail from video
                const thumbnailBuffer = await new Promise((resolve, reject) => {
                    const chunks = [];
                    ffmpeg(tempVideoUrl)
                        .screenshots({
                            count: 1,
                            timestamps: ['00:00:01'],
                            size: '?x200'
                        })
                        .on('error', reject)
                        .pipe()
                        .on('data', chunk => chunks.push(chunk))
                        .on('end', () => resolve(Buffer.concat(chunks)))
                        .on('error', reject);
                });

                // Upload thumbnail
                const thumbFilename = `thumb_${uniqueFilename.substring(0, uniqueFilename.lastIndexOf('.'))}.jpg`;
                thumbnailUrl = await uploadBlob(
                    `media/${thumbFilename}`,
                    thumbnailBuffer,
                    'image/jpeg'
                );

                context.log('Video thumbnail created');
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
        context.res = {
            status: 500,
            body: { error: 'Internal server error', message: error.message }
        };
    }
};
