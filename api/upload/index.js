const { execute } = require('../shared/db');
const { uploadBlob } = require('../shared/storage');

module.exports = async function (context, req) {
    context.log('Upload API function processed a request.');

    try {
        const { fileName, fileData, fileType, contentType } = req.body;

        if (!fileName || !fileData) {
            context.res = {
                status: 400,
                body: { error: 'File name and data are required' }
            };
            return;
        }

        // Decode base64 file data
        const buffer = Buffer.from(fileData, 'base64');
        
        // Generate unique filename
        const timestamp = Date.now();
        const uniqueFilename = `${timestamp}-${fileName}`;
        const mediaType = contentType?.startsWith('image/') ? 1 : 2; // 1=image, 2=video

        // Upload to blob storage
        const blobUrl = await uploadBlob(
            `media/${uniqueFilename}`,
            buffer,
            contentType || 'application/octet-stream'
        );

        // For images, we would generate thumbnail here
        const thumbnailUrl = blobUrl; // TODO: Generate actual thumbnail

        // Add to UnindexedFiles table
        const insertQuery = `
            INSERT INTO dbo.UnindexedFiles 
                (uiFileName, uiDirectory, uiThumbUrl, uiType, uiWidth, uiHeight, uiVtime, uiStatus, uiBlobUrl)
            VALUES 
                (@fileName, @directory, @thumbUrl, @type, @width, @height, @duration, 'N', @blobUrl)
        `;

        await execute(insertQuery, {
            fileName: uniqueFilename,
            directory: '',
            thumbUrl: thumbnailUrl,
            type: mediaType,
            width: 0,  // TODO: Extract dimensions
            height: 0,
            duration: 0,
            blobUrl,
        });

        context.res = {
            status: 201,
            body: {
                success: true,
                fileName: uniqueFilename,
                blobUrl,
                thumbnailUrl
            }
        };

    } catch (error) {
        context.log.error('Error:', error);
        context.res = {
            status: 500,
            body: { error: 'Internal server error', message: error.message }
        };
    }
};
