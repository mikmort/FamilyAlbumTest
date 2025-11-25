const { checkAuthorization } = require('../shared/auth');
const { getContainerClient } = require('../shared/storage');
const sharp = require('sharp');

module.exports = async function (context, req) {
    context.log('Rotate thumbnail function triggered');

    // Check authorization (requires Full access to modify files)
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

        context.log(`Rotating thumbnail for: ${fileName}`);

        const containerClient = getContainerClient();
        
        // Thumbnails are stored in thumbnails/media/{filename}
        const thumbnailPath = `thumbnails/media/${fileName}`;
        
        context.log(`Thumbnail path: ${thumbnailPath}`);

        const blockBlobClient = containerClient.getBlockBlobClient(thumbnailPath);

        // Check if blob exists
        const exists = await blockBlobClient.exists();
        if (!exists) {
            context.res = {
                status: 404,
                body: { error: 'Thumbnail not found' }
            };
            return;
        }

        // Download the thumbnail
        context.log('Downloading thumbnail...');
        const downloadResponse = await blockBlobClient.download();
        const chunks = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        context.log(`Downloaded ${buffer.length} bytes`);

        // Rotate 90 degrees clockwise
        context.log('Rotating 90° clockwise...');
        const rotatedBuffer = await sharp(buffer)
            .rotate(90)
            .jpeg({ quality: 80 })
            .toBuffer();
        
        context.log(`Rotated: ${buffer.length} -> ${rotatedBuffer.length} bytes`);

        // Upload the rotated thumbnail back to blob storage (overwrite)
        await blockBlobClient.uploadData(rotatedBuffer, {
            blobHTTPHeaders: {
                blobContentType: 'image/jpeg'
            }
        });

        context.log(`✓ Successfully rotated thumbnail: ${thumbnailPath}`);

        context.res = {
            status: 200,
            body: {
                success: true,
                thumbnailPath: thumbnailPath,
                originalSize: buffer.length,
                rotatedSize: rotatedBuffer.length
            }
        };

    } catch (err) {
        context.log.error('Error rotating thumbnail:', err);
        context.res = {
            status: 500,
            body: { 
                error: 'Failed to rotate thumbnail',
                details: err.message 
            }
        };
    }
};
