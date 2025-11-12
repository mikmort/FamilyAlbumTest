const { query } = require('../shared/db');
const { checkAuthorization } = require('../shared/auth');
const { getContainerClient, uploadBlob, blobExists } = require('../shared/storage');

// Make sharp optional
let sharp = null;
try {
    sharp = require('sharp');
} catch (err) {
    console.warn('Sharp module not available');
}

/**
 * Azure Function: Generate Midsize Images for Existing Files
 * 
 * This endpoint generates 1080px midsize versions for existing large images (>1MB)
 * that don't already have a midsize version.
 * 
 * GET /api/generate-midsize - Get status and count of files needing midsize
 * POST /api/generate-midsize/batch - Start batch processing (Admin only)
 * GET /api/generate-midsize/progress - Get progress of current batch (Admin only)
 */

// In-memory progress tracking
let batchProgress = {
    isRunning: false,
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    startTime: null,
    errors: []
};

module.exports = async function (context, req) {
    const method = req.method;
    const action = req.params.action;

    try {
        // GET /api/generate-midsize - Get count of files needing midsize (Read role)
        if (method === 'GET' && !action) {
            const { authorized, error } = await checkAuthorization(context, 'Read');
            if (!authorized) {
                context.res = { status: 403, body: { error } };
                return;
            }

            // Query for large images without midsize URLs
            const result = await query(`
                SELECT COUNT(*) as count
                FROM Pictures
                WHERE PType = 1 
                AND PMidsizeUrl IS NULL
                AND PBlobUrl IS NOT NULL
            `);

            const count = result[0]?.count || 0;

            context.res = {
                status: 200,
                body: {
                    filesNeedingMidsize: count,
                    message: `${count} images could benefit from midsize versions`
                }
            };
            return;
        }

        // GET /api/generate-midsize/progress - Get batch progress (Admin only)
        if (method === 'GET' && action === 'progress') {
            const { authorized, error } = await checkAuthorization(context, 'Admin');
            if (!authorized) {
                context.res = { status: 403, body: { error } };
                return;
            }

            context.res = {
                status: 200,
                body: batchProgress
            };
            return;
        }

        // POST /api/generate-midsize/batch - Start batch processing (Admin only)
        if (method === 'POST' && action === 'batch') {
            const { authorized, error } = await checkAuthorization(context, 'Admin');
            if (!authorized) {
                context.res = { status: 403, body: { error } };
                return;
            }

            if (!sharp) {
                context.res = {
                    status: 500,
                    body: { error: 'Sharp module not available for image processing' }
                };
                return;
            }

            if (batchProgress.isRunning) {
                context.res = {
                    status: 409,
                    body: { 
                        error: 'Batch processing already in progress',
                        progress: batchProgress
                    }
                };
                return;
            }

            // Get batch size from request (default 50, max 10000 for "process all")
            const batchSize = Math.min(req.body?.batchSize || 50, 10000);

            // Start batch processing (async)
            processBatch(context, batchSize);

            context.res = {
                status: 202,
                body: {
                    message: 'Batch processing started',
                    batchSize,
                    note: 'Use GET /api/generate-midsize/progress to check status'
                }
            };
            return;
        }

        context.res = {
            status: 400,
            body: { error: 'Invalid request. Use GET / or POST /batch' }
        };

    } catch (err) {
        context.log.error('Error in generate-midsize endpoint:', err);
        context.res = {
            status: 500,
            body: { error: err.message }
        };
    }
};

/**
 * Process a batch of images to generate midsize versions
 */
async function processBatch(context, batchSize) {
    try {
        // Reset progress
        batchProgress = {
            isRunning: true,
            total: 0,
            processed: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0,
            startTime: new Date(),
            errors: []
        };

        context.log(`Starting batch midsize generation (batch size: ${batchSize})...`);

        // Get images that need midsize versions
        const result = await query(`
            SELECT TOP ${batchSize}
                PFileName,
                PFileDirectory,
                PBlobUrl,
                PWidth,
                PHeight
            FROM Pictures
            WHERE PType = 1 
            AND PMidsizeUrl IS NULL
            AND PBlobUrl IS NOT NULL
            AND (PWidth > 1080 OR PHeight > 1080)
            ORDER BY PDateEntered DESC
        `);

        const images = result.recordset;
        batchProgress.total = images.length;

        context.log(`Found ${images.length} images to process`);

        const containerClient = getContainerClient();

        for (const image of images) {
            try {
                context.log(`Processing: ${image.PFileName}`);

                // Construct blob path
                let blobPath = image.PFileName;
                if (image.PFileDirectory) {
                    blobPath = `${image.PFileDirectory}/${image.PFileName}`;
                }
                
                // Try with and without media/ prefix
                let fullBlobPath = blobPath;
                if (!blobPath.startsWith('media/')) {
                    fullBlobPath = `media/${blobPath}`;
                }

                // Check if blob exists
                const blobClient = containerClient.getBlockBlobClient(fullBlobPath);
                const exists = await blobClient.exists();
                
                if (!exists) {
                    context.log.warn(`Blob not found: ${fullBlobPath}`);
                    batchProgress.skipped++;
                    batchProgress.processed++;
                    continue;
                }

                // Download the image
                const downloadResponse = await blobClient.download();
                const chunks = [];
                for await (const chunk of downloadResponse.readableStreamBody) {
                    chunks.push(Buffer.from(chunk));
                }
                const imageBuffer = Buffer.concat(chunks);
                const sizeMB = imageBuffer.length / (1024 * 1024);

                context.log(`Downloaded ${image.PFileName} (${sizeMB.toFixed(2)} MB)`);

                // Skip if <1MB
                if (sizeMB <= 1) {
                    context.log(`Skipping ${image.PFileName} - file size ${sizeMB.toFixed(2)}MB <= 1MB`);
                    batchProgress.skipped++;
                    batchProgress.processed++;
                    continue;
                }

                // Generate midsize (1080px max dimension)
                const midsizeBuffer = await sharp(imageBuffer)
                    .resize(1080, 1080, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 85, mozjpeg: true })
                    .toBuffer();

                const midsizeMetadata = await sharp(midsizeBuffer).metadata();
                const midsizeSizeMB = midsizeBuffer.length / (1024 * 1024);
                
                context.log(`Midsize created - ${midsizeMetadata.width}x${midsizeMetadata.height}, ${midsizeSizeMB.toFixed(2)} MB`);

                // Prepare midsize filename
                const fileExt = image.PFileName.substring(image.PFileName.lastIndexOf('.'));
                const baseName = image.PFileName.substring(0, image.PFileName.lastIndexOf('.'));
                const midsizeFileName = `${baseName}-midsize${fileExt}`;
                const midsizeBlobPath = image.PFileDirectory 
                    ? `media/${image.PFileDirectory}/${midsizeFileName}`
                    : `media/${midsizeFileName}`;

                // Check if midsize already exists
                const midsizeExists = await blobExists(midsizeBlobPath);
                if (midsizeExists) {
                    context.log(`Midsize already exists for ${image.PFileName}`);
                    
                    // Update database with existing midsize URL
                    const apiMidsizeUrl = `/api/media/${image.PFileDirectory ? image.PFileDirectory + '/' : ''}${midsizeFileName}`;
                    await query(`
                        UPDATE Pictures
                        SET PMidsizeUrl = @midsizeUrl,
                            PLastModifiedDate = GETDATE()
                        WHERE PFileName = @fileName
                    `, {
                        midsizeUrl: apiMidsizeUrl,
                        fileName: image.PFileName
                    });
                    
                    batchProgress.succeeded++;
                    batchProgress.processed++;
                    continue;
                }

                // Upload midsize
                const midsizeUrl = await uploadBlob(
                    midsizeBlobPath,
                    midsizeBuffer,
                    'image/jpeg'
                );

                context.log(`Uploaded midsize to: ${midsizeUrl}`);

                // Update database with midsize URL
                const apiMidsizeUrl = `/api/media/${image.PFileDirectory ? image.PFileDirectory + '/' : ''}${midsizeFileName}`;
                await query(`
                    UPDATE Pictures
                    SET PMidsizeUrl = @midsizeUrl,
                        PLastModifiedDate = GETDATE()
                    WHERE PFileName = @fileName
                `, {
                    midsizeUrl: apiMidsizeUrl,
                    fileName: image.PFileName
                });

                context.log(`✅ Successfully processed ${image.PFileName}`);
                batchProgress.succeeded++;

            } catch (err) {
                context.log.error(`Error processing ${image.PFileName}:`, err.message);
                batchProgress.failed++;
                batchProgress.errors.push({
                    fileName: image.PFileName,
                    error: err.message
                });
            }

            batchProgress.processed++;
        }

        batchProgress.isRunning = false;
        context.log(`Batch processing complete. Succeeded: ${batchProgress.succeeded}, Failed: ${batchProgress.failed}, Skipped: ${batchProgress.skipped}`);

    } catch (err) {
        context.log.error('Fatal error in batch processing:', err);
        batchProgress.isRunning = false;
        batchProgress.errors.push({
            fileName: 'BATCH_ERROR',
            error: err.message
        });
    }
}
