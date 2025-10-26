const { execute } = require('../shared/db');
const { getContainerClient } = require('../shared/storage');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { Readable } = require('stream');

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = async function (context, req) {
    context.log('Upload complete notification received');

    try {
        const { fileName, contentType } = req.body;

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
        const mediaType = contentType?.startsWith('image/') ? 1 : 2;

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
                        // EXIF dates are in format: "YYYY:MM:DD HH:MM:SS"
                        const exifBuffer = metadata.exif;
                        const exifString = exifBuffer.toString();
                        
                        // Look for DateTimeOriginal tag (0x9003)
                        const dateMatch = exifString.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
                        if (dateMatch) {
                            const [, yearStr, monthStr, dayStr] = dateMatch;
                            year = parseInt(yearStr);
                            month = parseInt(monthStr);
                            dateTaken = new Date(year, month - 1, parseInt(dayStr));
                            context.log(`Extracted date from EXIF: ${month}/${year}`);
                        }
                    } catch (exifErr) {
                        context.log('Could not parse EXIF date:', exifErr.message);
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
            try {
                context.log('Processing video...');
                
                // Get video metadata using ffprobe
                await new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(blobUrl, (err, metadata) => {
                        if (err) {
                            reject(err);
                        } else {
                            if (metadata.format && metadata.format.duration) {
                                duration = Math.round(metadata.format.duration);
                            }
                            if (metadata.streams && metadata.streams[0]) {
                                width = metadata.streams[0].width || 0;
                                height = metadata.streams[0].height || 0;
                            }
                            
                            // Extract creation date from metadata
                            if (metadata.format && metadata.format.tags) {
                                const tags = metadata.format.tags;
                                // Try various date fields (different formats use different tags)
                                const dateStr = tags.creation_time || tags.date || tags['com.apple.quicktime.creationdate'];
                                
                                if (dateStr) {
                                    try {
                                        dateTaken = new Date(dateStr);
                                        if (!isNaN(dateTaken.getTime())) {
                                            month = dateTaken.getMonth() + 1;
                                            year = dateTaken.getFullYear();
                                            context.log(`Extracted date from video metadata: ${month}/${year}`);
                                        }
                                    } catch (dateErr) {
                                        context.log('Could not parse video date:', dateErr.message);
                                    }
                                }
                            }
                            
                            context.log(`Video: ${width}x${height}, duration: ${duration}s`);
                            resolve();
                        }
                    });
                });

                // Thumbnail will be generated dynamically via API
                thumbnailUrl = apiThumbUrl;

            } catch (err) {
                context.log.error('Error processing video:', err);
                // Continue without thumbnail
                thumbnailUrl = apiUrl;
            }
        }

        // Add to UnindexedFiles table for processing
        const insertQuery = `
            INSERT INTO dbo.UnindexedFiles 
                (uiFileName, uiDirectory, uiThumbUrl, uiType, uiWidth, uiHeight, uiVtime, uiStatus, uiBlobUrl, uiMonth, uiYear)
            VALUES 
                (@fileName, @directory, @thumbUrl, @type, @width, @height, @duration, 'N', @blobUrl, @month, @year)
        `;

        await execute(insertQuery, {
            fileName: fileName,
            directory: '',
            thumbUrl: thumbnailUrl,
            type: mediaType,
            width: width,
            height: height,
            duration: duration,
            blobUrl: apiUrl,  // Store API URL instead of direct blob URL
            month: month || null,
            year: year || null,
        });

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
