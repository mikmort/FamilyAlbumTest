const { downloadBlob } = require('../shared/storage');
const sharp = require('sharp');

module.exports = async function (context, req) {
    const filename = req.params.filename;
    
    try {
        // Get the thumbnail filename
        const baseFilename = filename.substring(0, filename.lastIndexOf('.'));
        const thumbFilename = `thumb_${baseFilename}.jpg`;
        const thumbBlobPath = `media/${thumbFilename}`;
        
        context.log(`Downloading thumbnail: ${thumbBlobPath}`);
        
        // Download the thumbnail
        const thumbnailBuffer = await downloadBlob(thumbBlobPath);
        
        // Get metadata
        const metadata = await sharp(thumbnailBuffer).metadata();
        
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                filename: thumbFilename,
                size: thumbnailBuffer.length,
                dimensions: {
                    width: metadata.width,
                    height: metadata.height
                },
                format: metadata.format,
                orientation: metadata.orientation || 'none',
                hasExif: !!metadata.exif,
                exifOrientation: metadata.orientation
            }
        };
        
    } catch (err) {
        context.log.error('Error:', err);
        context.res = {
            status: 500,
            body: { error: err.message }
        };
    }
};
