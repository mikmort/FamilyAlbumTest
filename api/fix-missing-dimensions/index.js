const { execute } = require('../shared/db');
const { getContainerClient } = require('../shared/storage');
const { checkAuthorization } = require('../shared/auth');
const sharp = require('sharp');
const heicConvert = require('heic-convert');

module.exports = async function (context, req) {
    context.log('Fix missing dimensions function triggered');

    // Check authorization (requires Admin access)
    const { authorized, user, error } = await checkAuthorization(context, 'Admin');
    if (!authorized) {
        context.res = {
            status: 403,
            body: { error }
        };
        return;
    }

    try {
        // Get all pictures with NULL or 0 dimensions
        const query = `
            SELECT PFileName, PType, PBlobUrl
            FROM Pictures
            WHERE (PWidth IS NULL OR PWidth = 0 OR PHeight IS NULL OR PHeight = 0)
                AND PType = 1
            ORDER BY PDateEntered DESC
        `;
        
        const result = await execute(query);
        const pictures = result.recordset;
        
        context.log(`Found ${pictures.length} pictures with missing dimensions`);
        
        if (pictures.length === 0) {
            context.res = {
                status: 200,
                body: {
                    success: true,
                    message: 'No pictures found with missing dimensions',
                    fixed: 0,
                    failed: 0
                }
            };
            return;
        }

        const containerClient = getContainerClient();
        let fixedCount = 0;
        let failedCount = 0;
        const failures = [];

        for (const picture of pictures) {
            try {
                context.log(`Processing: ${picture.PFileName}`);
                
                const blockBlobClient = containerClient.getBlockBlobClient(`media/${picture.PFileName}`);
                
                // Check if blob exists
                const exists = await blockBlobClient.exists();
                if (!exists) {
                    context.log(`  ⚠️ Blob not found, skipping`);
                    failedCount++;
                    failures.push({ fileName: picture.PFileName, error: 'Blob not found' });
                    continue;
                }

                // Download blob
                const downloadResponse = await blockBlobClient.download();
                const chunks = [];
                for await (const chunk of downloadResponse.readableStreamBody) {
                    chunks.push(chunk);
                }
                let buffer = Buffer.concat(chunks);

                // Check if it's HEIC and convert if needed
                const lowerFileName = picture.PFileName.toLowerCase();
                if (lowerFileName.endsWith('.heic') || lowerFileName.endsWith('.heif')) {
                    context.log(`  Converting HEIC to JPEG...`);
                    try {
                        const jpegBuffer = await heicConvert({
                            buffer: buffer,
                            format: 'JPEG',
                            quality: 0.95
                        });
                        buffer = jpegBuffer;
                    } catch (heicErr) {
                        context.log(`  ⚠️ HEIC conversion failed, trying with original buffer: ${heicErr.message}`);
                    }
                }

                // Extract metadata
                const metadata = await sharp(buffer).metadata();
                const width = metadata.width || 0;
                const height = metadata.height || 0;

                if (width === 0 || height === 0) {
                    context.log(`  ⚠️ Could not extract dimensions`);
                    failedCount++;
                    failures.push({ fileName: picture.PFileName, error: 'Could not extract dimensions' });
                    continue;
                }

                context.log(`  Dimensions: ${width} x ${height}`);

                // Update Pictures table
                await execute(`
                    UPDATE Pictures
                    SET PWidth = @width, PHeight = @height
                    WHERE PFileName = @fileName
                `, {
                    width,
                    height,
                    fileName: picture.PFileName
                });

                context.log(`  ✓ Updated`);
                fixedCount++;

            } catch (err) {
                context.log.error(`  ❌ Error processing ${picture.PFileName}:`, err.message);
                failedCount++;
                failures.push({ fileName: picture.PFileName, error: err.message });
            }
        }

        context.log(`\n=== Summary ===`);
        context.log(`Total: ${pictures.length}`);
        context.log(`Fixed: ${fixedCount}`);
        context.log(`Failed: ${failedCount}`);

        context.res = {
            status: 200,
            body: {
                success: true,
                total: pictures.length,
                fixed: fixedCount,
                failed: failedCount,
                failures: failures.length > 0 ? failures : undefined
            }
        };

    } catch (err) {
        context.log.error('Error fixing dimensions:', err);
        context.res = {
            status: 500,
            body: {
                error: 'Failed to fix dimensions',
                details: err.message
            }
        };
    }
};
