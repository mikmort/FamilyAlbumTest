const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const { StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const { checkAuthorization } = require('../shared/auth');
const { getContainerClient } = require('../shared/storage');

// Generate a short-lived read SAS URL so FFmpeg can stream from blob directly
function generateReadSasUrl(blobClient) {
    const accountName = process.env.AZURE_STORAGE_ACCOUNT;
    const accountKey = process.env.AZURE_STORAGE_KEY;
    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const expiresOn = new Date(Date.now() + 30 * 60 * 1000);
    const sasToken = generateBlobSASQueryParameters({
        containerName: blobClient.containerName,
        blobName: blobClient.name,
        permissions: BlobSASPermissions.parse('r'),
        expiresOn
    }, credential).toString();
    return `${blobClient.url}?${sasToken}`;
}

let ffmpeg = null;
try {
    ffmpeg = require('fluent-ffmpeg');
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    ffmpeg.setFfmpegPath(ffmpegPath);
} catch (err) {
    console.warn('FFmpeg not available:', err.message);
}

module.exports = async function (context, req) {
    context.log('Re-encode video function triggered');

    try {
    const { authorized, error } = await checkAuthorization(context, 'Full');
    if (!authorized) {
        context.res = { status: 403, body: { error } };
        return;
    }

    if (!ffmpeg) {
        context.res = { status: 200, body: { success: false, error: 'FFmpeg not available on this server' } };
        return;
    }

    const rawFileName = req.params.fileName;
    if (!rawFileName) {
        context.res = { status: 200, body: { success: false, error: 'fileName parameter is required' } };
        return;
    }

    const fileName = decodeURIComponent(rawFileName).replace(/\\/g, '/');
    context.log(`Re-encoding video: ${fileName}`);

    {
        const containerClient = getContainerClient();

        const pathsToTry = [fileName, `media/${fileName}`];
        let blobClient = null;
        let foundPath = null;
        for (const p of pathsToTry) {
            const candidate = containerClient.getBlobClient(p);
            if (await candidate.exists()) {
                blobClient = candidate;
                foundPath = p;
                break;
            }
        }

        if (!blobClient) {
            context.res = { status: 200, body: { success: false, error: `Blob not found: ${fileName}` } };
            return;
        }

        context.log(`Found blob at: ${foundPath}`);

        const properties = await blobClient.getProperties();
        const sizeMB = (properties.contentLength / (1024 * 1024)).toFixed(1);
        context.log(`Blob size: ${sizeMB} MB`);

        // Stream directly from blob URL to avoid download-to-buffer latency
        const inputSasUrl = generateReadSasUrl(blobClient);
        const outputPath = path.join(os.tmpdir(), `reencode_out_${Date.now()}.mp4`);

        try {
            await new Promise((resolve, reject) => {
                ffmpeg(inputSasUrl)
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .outputOptions([
                        '-movflags +faststart',
                        '-pix_fmt yuv420p',
                        '-preset ultrafast',
                        '-crf 23'
                    ])
                    .on('start', (cmd) => context.log('FFmpeg command:', cmd))
                    .on('progress', (p) => {
                        if (p.percent) context.log(`Progress: ${Math.round(p.percent)}%`);
                    })
                    .on('error', reject)
                    .on('end', resolve)
                    .save(outputPath);
            });

            const outputBuffer = await fs.readFile(outputPath);
            context.log(`Re-encoded: ${sizeMB} MB input -> ${(outputBuffer.length / (1024*1024)).toFixed(1)} MB output`);

            const blockBlobClient = containerClient.getBlockBlobClient(foundPath);
            await blockBlobClient.uploadData(outputBuffer, {
                blobHTTPHeaders: { blobContentType: 'video/mp4' }
            });

            context.log(`✓ Uploaded re-encoded video: ${foundPath}`);

            context.res = {
                status: 200,
                body: {
                    success: true,
                    message: 'Video re-encoded to H.264 successfully',
                    originalSizeMB: sizeMB,
                    newSizeMB: (outputBuffer.length / (1024*1024)).toFixed(1)
                }
            };
        } finally {
            await fs.unlink(outputPath).catch(() => {});
        }
    }
    } catch (err) {
        context.log.error('Re-encode error:', err);
        context.res = {
            status: 200,
            body: { success: false, error: err.message || 'Re-encode failed' }
        };
    }
};
