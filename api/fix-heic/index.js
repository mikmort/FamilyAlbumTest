const { checkAuthorization } = require('../shared/auth');
const { getContainerClient } = require('../shared/storage');
const sharp = require('sharp');

module.exports = async function (context, req) {
    context.log('Fix HEIC function triggered');

    // Check authorization (requires Full access to fix files)
    const { authorized, user, error } = await checkAuthorization(context, 'Full');
    if (!authorized) {
        context.res = {
            status: 403,
            body: { error }
        };
        return;
    }

    try {
        const fileName = req.params.fileName;
        if (!fileName) {
            context.res = {
                status: 400,
                body: { error: 'fileName parameter is required' }
            };
            return;
        }

        context.log(`Attempting to fix HEIC file: ${fileName}`);

        const containerClient = getContainerClient();
        const blockBlobClient = containerClient.getBlockBlobClient(`media/${fileName}`);

        // Check if blob exists
        const exists = await blockBlobClient.exists();
        if (!exists) {
            context.res = {
                status: 404,
                body: { error: 'File not found' }
            };
            return;
        }

        // Download the blob
        context.log('Downloading blob...');
        const downloadResponse = await blockBlobClient.download();
        const chunks = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        context.log(`Downloaded ${buffer.length} bytes`);

        // Just try to process it - Sharp will either convert it or fail with a clear error
        context.log('Attempting to process with Sharp...');
        let jpgBuffer;
        try {
            jpgBuffer = await sharp(buffer)
                .rotate() // Auto-rotate based on EXIF
                .withMetadata({}) // Strip EXIF after rotation
                .jpeg({ quality: 95, mozjpeg: true })
                .toBuffer();
            
            context.log(`✓ Processed: ${buffer.length} -> ${jpgBuffer.length} bytes`);
        } catch (processErr) {
            context.log.error('❌ Processing failed:', processErr.message);
            context.res = {
                status: 500,
                body: { 
                    error: 'Processing failed',
                    details: processErr.message,
                    message: `Sharp could not process this file. Error: ${processErr.message}`
                }
            };
            return;
        }

        // Upload the converted JPG back to blob storage (overwrite)
        context.log('Uploading converted file...');
        await blockBlobClient.uploadData(jpgBuffer, {
            blobHTTPHeaders: {
                blobContentType: 'image/jpeg'
            }
        });

        context.log(`✓ Successfully converted and uploaded: ${fileName}`);

        context.res = {
            status: 200,
            body: {
                success: true,
                fileName,
                originalSize: buffer.length,
                convertedSize: jpgBuffer.length,
                format: 'JPEG'
            }
        };

    } catch (err) {
        context.log.error('Error fixing HEIC file:', err);
        context.res = {
            status: 500,
            body: { 
                error: 'Failed to fix HEIC file',
                details: err.message 
            }
        };
    }
};
