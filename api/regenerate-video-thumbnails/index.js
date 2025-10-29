const { query, execute } = require('../shared/db');
const { downloadBlob, uploadBlob } = require('../shared/storage');
const ffmpeg = require('fluent-ffmpeg');
const { Readable } = require('stream');

module.exports = async function (context, req) {
    context.log('Regenerating video thumbnails...');

    try {
        // Get all videos that don't have thumbnails or have thumbnails pointing to the video itself
        const videos = await query(`
            SELECT PFileName, PBlobUrl, PThumbnailUrl, PType
            FROM Pictures
            WHERE PType = 2
            AND (PThumbnailUrl IS NULL OR PThumbnailUrl = '' OR PThumbnailUrl = PBlobUrl)
            ORDER BY PDateEntered DESC
        `);

        context.log(`Found ${videos.length} videos without thumbnails`);

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // Process each video
        for (const video of videos) {
            try {
                context.log(`Processing: ${video.PFileName}`);

                // Extract blob path from URL
                const blobPath = video.PBlobUrl.split('.net/')[1];
                
                // Download video from blob storage
                const videoBuffer = await downloadBlob(blobPath);
                context.log(`Downloaded video: ${videoBuffer.length} bytes`);

                // Determine video format from filename
                const ext = video.PFileName.toLowerCase().split('.').pop();
                const inputFormat = ext === 'mov' ? 'mov' : ext === 'avi' ? 'avi' : 'mp4';

                // Generate thumbnail using FFmpeg
                const thumbnailBuffer = await new Promise((resolve, reject) => {
                    const chunks = [];
                    const inputStream = Readable.from(videoBuffer);
                    
                    ffmpeg(inputStream)
                        .inputFormat(inputFormat)
                        .outputFormat('image2')
                        .outputOptions([
                            '-vframes 1',      // Extract only 1 frame
                            '-ss 00:00:01',    // Seek to 1 second
                            '-vf scale=-1:200' // Scale to height 200, maintain aspect ratio
                        ])
                        .on('start', (cmd) => context.log('FFmpeg command:', cmd))
                        .on('error', (err) => {
                            context.log.error('FFmpeg error:', err);
                            reject(err);
                        })
                        .on('end', () => {
                            context.log('Thumbnail extraction completed');
                            resolve(Buffer.concat(chunks));
                        })
                        .pipe()
                        .on('data', (chunk) => chunks.push(chunk));
                });

                context.log(`Generated thumbnail: ${thumbnailBuffer.length} bytes`);

                // Upload thumbnail
                const baseFilename = video.PFileName.substring(0, video.PFileName.lastIndexOf('.'));
                const thumbFilename = `thumb_${baseFilename}.jpg`;
                const thumbnailUrl = await uploadBlob(
                    `media/${thumbFilename}`,
                    thumbnailBuffer,
                    'image/jpeg'
                );

                context.log(`Uploaded thumbnail: ${thumbnailUrl}`);

                // Update database
                await execute(`
                    UPDATE Pictures
                    SET PThumbnailUrl = @thumbnailUrl,
                        PLastModifiedDate = GETDATE()
                    WHERE PFileName = @fileName
                `, {
                    thumbnailUrl,
                    fileName: video.PFileName
                });

                context.log(`✅ Updated database for ${video.PFileName}`);
                results.success++;

            } catch (err) {
                context.log.error(`❌ Failed to process ${video.PFileName}:`, err);
                results.failed++;
                results.errors.push({
                    fileName: video.PFileName,
                    error: err.message
                });
            }
        }

        context.log(`Completed: ${results.success} success, ${results.failed} failed`);

        context.res = {
            status: 200,
            body: {
                success: true,
                message: `Processed ${videos.length} videos`,
                results
            }
        };

    } catch (error) {
        context.log.error('Error regenerating thumbnails:', error);
        context.res = {
            status: 500,
            body: {
                success: false,
                error: error.message
            }
        };
    }
};
