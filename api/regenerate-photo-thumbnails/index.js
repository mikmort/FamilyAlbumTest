const { query, execute } = require('../shared/db');
const { downloadBlob, uploadBlob, deleteBlob } = require('../shared/storage');
const { checkAuthorization } = require('../shared/auth');
const sharp = require('sharp');

/**
 * Regenerate photo thumbnails using the new rotation logic
 * This fixes old thumbnails that have incorrect orientation
 */
module.exports = async function (context, req) {
    context.log('=== Regenerate Photo Thumbnails API ===');

    // Check authorization - Admin only
    const { authorized, user, error } = await checkAuthorization(context, 'Admin');
    if (!authorized) {
        context.res = {
            status: 403,
            body: { error }
        };
        return;
    }

    try {
        // Get parameters from request body
        const { fileNames, all } = req.body || {};

        let photos;
        if (all) {
            // Get all photos (PType = 1)
            context.log('Regenerating thumbnails for ALL photos');
            photos = await query(`
                SELECT PFileName, PBlobUrl, PThumbnailUrl, PType
                FROM Pictures
                WHERE PType = 1
                ORDER BY PDateEntered DESC
            `);
        } else if (fileNames && Array.isArray(fileNames) && fileNames.length > 0) {
            // Get specific photos by filename
            context.log(`Regenerating thumbnails for ${fileNames.length} specific photos`);
            const placeholders = fileNames.map((_, i) => `@fileName${i}`).join(',');
            const params = {};
            fileNames.forEach((name, i) => {
                params[`fileName${i}`] = name;
            });
            
            photos = await query(`
                SELECT PFileName, PBlobUrl, PThumbnailUrl, PType
                FROM Pictures
                WHERE PType = 1
                AND PFileName IN (${placeholders})
            `, params);
        } else {
            context.res = {
                status: 400,
                body: { error: 'Must provide either "all": true or "fileNames": [...]' }
            };
            return;
        }

        context.log(`Found ${photos.length} photos to process`);

        const results = {
            success: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        // Process each photo
        for (const photo of photos) {
            try {
                context.log(`Processing: ${photo.PFileName}`);

                // Extract blob path from URL
                const blobPath = photo.PBlobUrl.split('.net/')[1];
                if (!blobPath) {
                    context.log(`⚠️ Could not extract blob path from: ${photo.PBlobUrl}`);
                    results.skipped++;
                    continue;
                }
                
                // Download original photo from blob storage
                const photoBuffer = await downloadBlob(blobPath);
                context.log(`Downloaded photo: ${photoBuffer.length} bytes`);

                // Create rotated buffer using two-step process
                // This matches the logic in api/upload/index.js
                const rotatedOnce = await sharp(photoBuffer, { failOnError: false })
                    .rotate() // Auto-rotate based on EXIF
                    .toBuffer();
                
                const rotatedBuffer = await sharp(rotatedOnce)
                    .withMetadata({}) // Strip all metadata
                    .jpeg({ quality: 95, mozjpeg: true })
                    .toBuffer();

                // Get metadata from rotated image
                const metadata = await sharp(rotatedBuffer).metadata();
                context.log(`Rotated image - dimensions: ${metadata.width}x${metadata.height}, orientation: ${metadata.orientation || 'undefined'}`);

                // Create thumbnail from rotated buffer
                const thumbnailBuffer = await sharp(rotatedBuffer)
                    .resize(null, 200, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 80 })
                    .toBuffer();

                const thumbMetadata = await sharp(thumbnailBuffer).metadata();
                context.log(`Thumbnail created - dimensions: ${thumbMetadata.width}x${thumbMetadata.height}`);

                // Prepare thumbnail filename
                const fileExt = photo.PFileName.substring(photo.PFileName.lastIndexOf('.'));
                const thumbFilename = `thumb_${photo.PFileName.substring(0, photo.PFileName.lastIndexOf('.'))}.jpg`;
                const thumbBlobPath = `media/${thumbFilename}`;
                
                // Delete existing thumbnail
                try {
                    await deleteBlob(thumbBlobPath);
                    context.log(`✅ Deleted old thumbnail`);
                } catch (deleteErr) {
                    context.log(`No old thumbnail to delete: ${deleteErr.message}`);
                }
                
                // Upload new thumbnail
                const thumbnailUrl = await uploadBlob(
                    thumbBlobPath,
                    thumbnailBuffer,
                    'image/jpeg'
                );

                context.log(`✅ Uploaded new thumbnail: ${thumbnailUrl}`);

                // Update database with new timestamp to bust cache
                await execute(`
                    UPDATE Pictures
                    SET PLastModifiedDate = GETDATE()
                    WHERE PFileName = @fileName
                `, {
                    fileName: photo.PFileName
                });

                context.log(`✅ Updated database for ${photo.PFileName}`);
                results.success++;

            } catch (err) {
                context.log.error(`❌ Failed to process ${photo.PFileName}:`, err);
                results.failed++;
                results.errors.push({
                    fileName: photo.PFileName,
                    error: err.message
                });
            }
        }

        context.log(`\n=== Summary ===`);
        context.log(`Total: ${photos.length}`);
        context.log(`Success: ${results.success}`);
        context.log(`Failed: ${results.failed}`);
        context.log(`Skipped: ${results.skipped}`);

        context.res = {
            status: 200,
            body: {
                message: 'Thumbnail regeneration complete',
                total: photos.length,
                ...results
            }
        };

    } catch (err) {
        context.log.error('Error in regenerate-photo-thumbnails:', err);
        context.res = {
            status: 500,
            body: { error: err.message }
        };
    }
};
