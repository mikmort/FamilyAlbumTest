const { checkAuthorization } = require('../shared/auth');
const { getContainerClient } = require('../shared/storage');
const sharp = require('sharp');
const heicConvert = require('heic-convert');

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

        // Convert HEIC to JPEG using heic-convert library
        context.log('Converting HEIC to JPEG with heic-convert...');
        let jpegBuffer;
        try {
            jpegBuffer = await heicConvert({
                buffer: buffer,
                format: 'JPEG',
                quality: 0.95
            });
            
            context.log(`✓ HEIC converted: ${buffer.length} -> ${jpegBuffer.length} bytes`);
        } catch (heicErr) {
            context.log.error('❌ HEIC conversion failed:', heicErr.message);
            context.res = {
                status: 500,
                body: { 
                    error: 'HEIC conversion failed',
                    details: heicErr.message,
                    message: `Could not convert HEIC file: ${heicErr.message}`
                }
            };
            return;
        }

        // Now process with Sharp for rotation and optimization
        context.log('Processing with Sharp for rotation...');
        let jpgBuffer;
        try {
            jpgBuffer = await sharp(jpegBuffer)
                .rotate() // Auto-rotate based on EXIF
                .withMetadata({}) // Strip EXIF after rotation
                .jpeg({ quality: 95, mozjpeg: true })
                .toBuffer();
            
            context.log(`✓ Sharp processing: ${jpegBuffer.length} -> ${jpgBuffer.length} bytes`);
        } catch (sharpErr) {
            context.log.error('❌ Sharp processing failed:', sharpErr.message);
            // Use the heic-convert output if Sharp fails
            jpgBuffer = jpegBuffer;
            context.log('Using heic-convert output directly');
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
