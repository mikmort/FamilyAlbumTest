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
            // Note: Don't filter by PBlobUrl - old images don't have this field populated
            const result = await query(`
                SELECT COUNT(*) as count
                FROM Pictures
                WHERE PType = 1 
                AND PMidsizeUrl IS NULL
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
        // Filter for images that are likely large enough (>1080px in at least one dimension)
        // Images without dimensions will still be checked, but prioritize known large images
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
            AND (
                PWidth > 1080 
                OR PHeight > 1080 
                OR PWidth IS NULL 
                OR PHeight IS NULL
            )
            ORDER BY 
                -- Prioritize images with known large dimensions
                CASE WHEN (PWidth > 1080 OR PHeight > 1080) THEN 0 ELSE 1 END,
                PDateEntered DESC
        `);

        const images = result || [];
        batchProgress.total = images.length;

        context.log(`Found ${images.length} images to process`);

        const containerClient = getContainerClient();

        for (const image of images) {
            try {
                context.log(`Processing: ${image.PFileName}`);

                // Construct blob paths to try
                // Old images might be stored at root OR under media/ prefix
                // Try multiple locations to find the blob
                let fullBlobPath;
                let pathsToTry = [];
                
                if (image.PFileName.includes('/')) {
                    // Old format - PFileName already has full path
                    // Try both at root and under media/ prefix
                    pathsToTry.push(image.PFileName);
                    pathsToTry.push(`media/${image.PFileName}`);
                } else if (image.PFileDirectory) {
                    // New format with directory - convert backslashes to forward slashes
                    const directory = image.PFileDirectory.replace(/\\/g, '/');
                    pathsToTry.push(`media/${directory}/${image.PFileName}`);
                } else {
                    // New format without directory - stored in media/ folder
                    pathsToTry.push(`media/${image.PFileName}`);
                }

                context.log(`Trying blob paths for: ${image.PFileName}`);
                context.log(`  PFileDirectory: ${image.PFileDirectory || 'NULL'}`);
                
                // Try each path until we find the blob
                let blobClient = null;
                for (const tryPath of pathsToTry) {
                    context.log(`  Checking: ${tryPath}`);
                    const testClient = containerClient.getBlockBlobClient(tryPath);
                    const exists = await testClient.exists();
                    if (exists) {
                        fullBlobPath = tryPath;
                        blobClient = testClient;
                        context.log(`  ✅ Found at: ${tryPath}`);
                        break;
                    }
                }
                
                if (!blobClient) {
                    context.log.warn(`❌ Blob not found in any location:`, pathsToTry);
                    batchProgress.errors.push(`${image.PFileName}: Blob not found`);
                    batchProgress.skipped++;
                    batchProgress.processed++;
                    continue;
                }

                // Check dimensions if available - skip small images without downloading
                if (image.PWidth && image.PHeight && image.PWidth <= 1080 && image.PHeight <= 1080) {
                    context.log(`Skipping ${image.PFileName} - dimensions ${image.PWidth}x${image.PHeight} <= 1080px`);
                    batchProgress.skipped++;
                    batchProgress.processed++;
                    
                    // Mark as processed (set PMidsizeUrl to empty string or NULL to indicate "checked but not needed")
                    // Actually, don't update DB - let it stay NULL since midsize not needed
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

                // Skip if <500KB
                if (sizeMB <= 0.5) {
                    context.log(`Skipping ${image.PFileName} - file size ${sizeMB.toFixed(2)}MB <= 0.5MB`);
                    batchProgress.skipped++;
                    batchProgress.processed++;
                    continue;
                }

                // Get actual dimensions
                const metadata = await sharp(imageBuffer).metadata();
                const actualWidth = metadata.width || 0;
                const actualHeight = metadata.height || 0;
                
                context.log(`Image dimensions: ${actualWidth}x${actualHeight}`);
                
                // Skip if dimensions are <= 1080px
                if (actualWidth <= 1080 && actualHeight <= 1080) {
                    context.log(`Skipping ${image.PFileName} - dimensions ${actualWidth}x${actualHeight} <= 1080px`);
                    batchProgress.skipped++;
                    batchProgress.processed++;
                    continue;
                }

                // Generate midsize (1080px max dimension)
                // Note: .rotate() without arguments auto-rotates based on EXIF orientation
                const midsizeBuffer = await sharp(imageBuffer)
                    .rotate() // Auto-rotate based on EXIF orientation
                    .resize(1080, 1080, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 85, mozjpeg: true })
                    .toBuffer();

                const midsizeMetadata = await sharp(midsizeBuffer).metadata();
                const midsizeSizeMB = midsizeBuffer.length / (1024 * 1024);
                
                context.log(`Midsize created - ${midsizeMetadata.width}x${midsizeMetadata.height}, ${midsizeSizeMB.toFixed(2)} MB`);

                // Prepare midsize filename and path
                // Store midsize in same location as original (match the path structure)
                const fileExt = fullBlobPath.substring(fullBlobPath.lastIndexOf('.'));
                const basePath = fullBlobPath.substring(0, fullBlobPath.lastIndexOf('.'));
                const midsizeBlobPath = `${basePath}-midsize${fileExt}`;
                
                // Extract directory and filename for API URL
                const fullPathNormalized = fullBlobPath.replace(/\\/g, '/');
                const pathParts = fullPathNormalized.split('/');
                const fileNameOnly = pathParts[pathParts.length - 1];
                const fileNameBase = fileNameOnly.substring(0, fileNameOnly.lastIndexOf('.'));
                const fileNameExt = fileNameOnly.substring(fileNameOnly.lastIndexOf('.'));
                const midsizeFileName = `${fileNameBase}-midsize${fileNameExt}`;
                
                // Build API URL - remove media/ prefix if present
                let apiPath = fullPathNormalized.startsWith('media/') 
                    ? fullPathNormalized.substring(6)  // Remove "media/" prefix
                    : fullPathNormalized;
                const directory = pathParts.slice(0, -1).join('/').replace(/^media\/?/, ''); // Remove media/ from directory
                const apiMidsizeUrl = directory 
                    ? `/api/media/${directory}/${midsizeFileName}`
                    : `/api/media/${midsizeFileName}`;

                context.log(`Midsize will be stored at: ${midsizeBlobPath}`);
                context.log(`API URL will be: ${apiMidsizeUrl}`);

                // Check if midsize already exists
                const midsizeExists = await blobExists(midsizeBlobPath);
                if (midsizeExists) {
                    context.log(`Midsize already exists for ${image.PFileName}`);
                    
                    // Update database with midsize URL
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
