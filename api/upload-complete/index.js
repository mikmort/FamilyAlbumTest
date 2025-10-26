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

        let thumbnailUrl = null;
        let width = 0;
        let height = 0;
        let duration = 0;

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

                // Get metadata
                const metadata = await sharp(buffer).metadata();
                width = metadata.width || 0;
                height = metadata.height || 0;

                context.log(`Image dimensions: ${width}x${height}`);

                // Thumbnail will be generated dynamically via ?thumbnail=true
                thumbnailUrl = blobUrl + '?thumbnail=true';

            } catch (err) {
                context.log.error('Error processing image:', err);
                // Continue without thumbnail
                thumbnailUrl = blobUrl;
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
                            context.log(`Video: ${width}x${height}, duration: ${duration}s`);
                            resolve();
                        }
                    });
                });

                // Thumbnail will be generated dynamically via ?thumbnail=true
                thumbnailUrl = blobUrl + '?thumbnail=true';

            } catch (err) {
                context.log.error('Error processing video:', err);
                // Continue without thumbnail
                thumbnailUrl = blobUrl;
            }
        }

        // Add to UnindexedFiles table for processing
        const insertQuery = `
            INSERT INTO dbo.UnindexedFiles 
                (uiFileName, uiDirectory, uiThumbUrl, uiType, uiWidth, uiHeight, uiVtime, uiStatus, uiBlobUrl)
            VALUES 
                (@fileName, @directory, @thumbUrl, @type, @width, @height, @duration, 'N', @blobUrl)
        `;

        await execute(insertQuery, {
            fileName: fileName,
            directory: '',
            thumbUrl: thumbnailUrl,
            type: mediaType,
            width: width,
            height: height,
            duration: duration,
            blobUrl: blobUrl,
        });

        context.log(`File registered in database: ${fileName}`);

        context.res = {
            status: 200,
            body: {
                success: true,
                fileName: fileName,
                blobUrl: blobUrl,
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
