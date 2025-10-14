const { app } = require('@azure/functions');
const { execute } = require('../shared/db');
const { uploadBlob } = require('../shared/storage');

app.http('upload', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        try {
            // Note: Azure Functions v4 handles multipart/form-data differently
            // For now, we'll accept JSON with base64 encoded file data
            const body = await request.json();
            const { fileName, fileData, fileType, contentType } = body;

            if (!fileName || !fileData) {
                return {
                    status: 400,
                    jsonBody: { error: 'File name and data are required' }
                };
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
            // For now, use placeholder
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

            return {
                status: 201,
                jsonBody: {
                    success: true,
                    fileName: uniqueFilename,
                    blobUrl,
                    thumbnailUrl
                }
            };

        } catch (error) {
            context.error('Error:', error);
            return {
                status: 500,
                jsonBody: { error: 'Internal server error', message: error.message }
            };
        }
    }
});
