const { generateUploadSasUrl } = require('../shared/storage');
const { query } = require('../shared/db');

/**
 * Check if filename exists and generate Windows-style duplicate name if needed
 * Same logic as in upload/index.js
 */
async function getUniqueFilename(originalFilename) {
    const fileExt = originalFilename.substring(originalFilename.lastIndexOf('.'));
    const fileNameWithoutExt = originalFilename.substring(0, originalFilename.lastIndexOf('.'));
    
    // Check if the exact original filename exists
    const exactCheckQuery = `
        SELECT PFileName 
        FROM dbo.Pictures 
        WHERE PFileName = @filename
    `;
    
    const existingExact = await query(exactCheckQuery, { 
        filename: originalFilename
    });
    
    // If no duplicate, return original filename
    if (!existingExact || existingExact.length === 0) {
        return originalFilename;
    }
    
    // Original exists, need to find numbered version
    let counter = 1;
    let foundGap = false;
    
    // Check sequentially for numbered versions: (1), (2), (3), etc.
    while (!foundGap && counter < 1000) {
        const numberedFilename = `${fileNameWithoutExt} (${counter})${fileExt}`;
        const numberedCheckQuery = `
            SELECT PFileName 
            FROM dbo.Pictures 
            WHERE PFileName = @filename
        `;
        
        const numberedExists = await query(numberedCheckQuery, { 
            filename: numberedFilename
        });
        
        if (numberedExists && numberedExists.length > 0) {
            counter++;
        } else {
            // Found a gap - this number is available
            foundGap = true;
            return numberedFilename;
        }
    }
    
    // Safety fallback
    return `${fileNameWithoutExt} (${counter})${fileExt}`;
}

module.exports = async function (context, req) {
    context.log('Get upload URL API called');

    try {
        let { fileName } = req.query;

        if (!fileName) {
            context.res = {
                status: 400,
                body: { 
                    success: false,
                    error: 'fileName query parameter is required' 
                }
            };
            return;
        }

        context.log('Requested filename:', fileName);

        // Convert AVI files to MP4 (change extension before generating SAS URL)
        const lowerFileName = fileName.toLowerCase();
        if (lowerFileName.endsWith('.avi')) {
            const lastDotIndex = fileName.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                fileName = fileName.substring(0, lastDotIndex) + '.mp4';
                context.log(`AVI file detected. Changed extension: ${req.query.fileName} -> ${fileName}`);
            }
        }

        // Check for duplicates and get unique filename
        const uniqueFilename = await getUniqueFilename(fileName);
        
        if (uniqueFilename !== fileName) {
            context.log(`Duplicate detected. Will use: ${uniqueFilename}`);
        }

        // Generate SAS URL for direct upload (valid for 60 minutes)
        const sasUrl = generateUploadSasUrl(`media/${uniqueFilename}`, 60);

        context.log('Generated SAS URL for:', uniqueFilename);

        context.res = {
            status: 200,
            body: {
                success: true,
                fileName: uniqueFilename,
                uploadUrl: sasUrl,
                originalFileName: fileName,
                renamed: uniqueFilename !== fileName
            }
        };

    } catch (error) {
        context.log.error('Get upload URL error:', error);
        context.res = {
            status: 500,
            body: { 
                success: false,
                error: 'Internal server error', 
                message: error.message 
            }
        };
    }
};

// Trigger redeploy: trivial comment
// Redeploy requested on October 30, 2025
