const { query } = require('../shared/db');
const { getContainerClient } = require('../shared/storage');
const { checkAuthorization } = require('../shared/auth');
const sharp = require('sharp');

// Progress tracking (in-memory - resets on function restart)
let regenerateProgress = {
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

    try {
        // GET /api/regenerate-midsize/progress - Get progress (Read role)
        if (method === 'GET') {
            const { authorized, error } = await checkAuthorization(context, 'Read');
            if (!authorized) {
                context.res = { status: 403, body: { error } };
                return;
            }

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: regenerateProgress
            };
            return;
        }

        // POST /api/regenerate-midsize - Start regeneration (Full role)
        if (method === 'POST') {
            const { authorized, error } = await checkAuthorization(context, 'Full');
            if (!authorized) {
                context.res = { status: 403, body: { error } };
                return;
            }

            if (regenerateProgress.isRunning) {
                context.res = {
                    status: 409,
                    body: { error: 'Regeneration already in progress' }
                };
                return;
            }

            // Start regeneration
            regenerateProgress = {
                isRunning: true,
                total: 0,
                processed: 0,
                succeeded: 0,
                failed: 0,
                skipped: 0,
                startTime: new Date().toISOString(),
                errors: []
            };

            // Process asynchronously
            processRegenerateAll(context).catch(err => {
                context.log.error('Regeneration error:', err);
                regenerateProgress.isRunning = false;
            });

            context.res = {
                status: 202,
                body: { 
                    message: 'Regeneration started',
                    note: 'Use GET /api/regenerate-midsize/progress to check status'
                }
            };
            return;
        }

        context.res = { status: 405, body: { error: 'Method not allowed' } };
    } catch (error) {
        context.log.error('Error:', error);
        context.res = {
            status: 500,
            body: { error: error.message }
        };
    }
};

async function processRegenerateAll(context) {
    const containerClient = getContainerClient();

    try {
        context.log('Starting midsize regeneration...');

        // Get all images with midsize URLs
        const result = await query(`
            SELECT 
                PFileName,
                PFileDirectory,
                PBlobUrl,
                PMidsizeUrl
            FROM Pictures
            WHERE PType = 1 
            AND PMidsizeUrl IS NOT NULL
            ORDER BY PDateEntered DESC
        `);

        const images = result || [];
        regenerateProgress.total = images.length;
        context.log(`Found ${images.length} images to regenerate`);

        for (const image of images) {
            try {
                context.log(`Processing: ${image.PFileName}`);

                // Construct original blob path
                let fullBlobPath;
                if (image.PFileName.includes('/')) {
                    fullBlobPath = image.PFileName;
                } else if (image.PFileDirectory) {
                    const directory = image.PFileDirectory.replace(/\\/g, '/');
                    fullBlobPath = `media/${directory}/${image.PFileName}`;
                } else {
                    fullBlobPath = `media/${image.PFileName}`;
                }

                // Download original
                const blobClient = containerClient.getBlockBlobClient(fullBlobPath);
                const exists = await blobClient.exists();

                if (!exists) {
                    context.log.warn(`Blob not found: ${fullBlobPath}`);
                    regenerateProgress.skipped++;
                    regenerateProgress.processed++;
                    continue;
                }

                const downloadResponse = await blobClient.download();
                const chunks = [];
                for await (const chunk of downloadResponse.readableStreamBody) {
                    chunks.push(Buffer.from(chunk));
                }
                const imageBuffer = Buffer.concat(chunks);
                const sizeMB = imageBuffer.length / (1024 * 1024);

                // Skip small images
                if (sizeMB <= 1) {
                    context.log(`Skipping ${image.PFileName} - too small`);
                    regenerateProgress.skipped++;
                    regenerateProgress.processed++;
                    continue;
                }

                // Generate new midsize with correct orientation
                const midsizeBuffer = await sharp(imageBuffer)
                    .rotate() // Auto-rotate based on EXIF
                    .resize(1080, 1080, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 85, mozjpeg: true })
                    .toBuffer();

                const midsizeMetadata = await sharp(midsizeBuffer).metadata();
                const midsizeSizeMB = midsizeBuffer.length / (1024 * 1024);

                context.log(`Midsize created - ${midsizeMetadata.width}x${midsizeMetadata.height}, ${midsizeSizeMB.toFixed(2)} MB`);

                // Construct midsize blob path
                const fileExt = image.PFileName.substring(image.PFileName.lastIndexOf('.'));
                const baseName = image.PFileName.substring(0, image.PFileName.lastIndexOf('.'));
                const midsizeFileName = `${baseName}-midsize.jpg`;

                let midsizeBlobPath;
                if (image.PFileName.includes('/')) {
                    const lastSlash = image.PFileName.lastIndexOf('/');
                    const directory = image.PFileName.substring(0, lastSlash);
                    midsizeBlobPath = `${directory}/${midsizeFileName}`;
                } else if (image.PFileDirectory) {
                    const directory = image.PFileDirectory.replace(/\\/g, '/');
                    midsizeBlobPath = `media/${directory}/${midsizeFileName}`;
                } else {
                    midsizeBlobPath = `media/${midsizeFileName}`;
                }

                // Upload new midsize
                const midsizeBlobClient = containerClient.getBlockBlobClient(midsizeBlobPath);
                await midsizeBlobClient.uploadData(midsizeBuffer, {
                    blobHTTPHeaders: { blobContentType: 'image/jpeg' }
                });

                context.log(`Uploaded: ${midsizeBlobPath}`);
                regenerateProgress.succeeded++;
                regenerateProgress.processed++;

            } catch (error) {
                context.log.error(`Error processing ${image.PFileName}:`, error);
                regenerateProgress.failed++;
                regenerateProgress.processed++;
                regenerateProgress.errors.push({
                    file: image.PFileName,
                    error: error.message
                });
            }
        }

        context.log('Regeneration complete');
        regenerateProgress.isRunning = false;

    } catch (error) {
        context.log.error('Fatal error:', error);
        regenerateProgress.isRunning = false;
        throw error;
    }
}
