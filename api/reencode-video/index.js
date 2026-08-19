const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const { checkAuthorization } = require('../shared/auth');
const { getContainerClient } = require('../shared/storage');

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

        const downloadResponse = await blobClient.download();
        const chunks = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
            chunks.push(chunk);
        }
        const inputBuffer = Buffer.concat(chunks);
        context.log(`Downloaded ${inputBuffer.length} bytes`);

        const tempDir = os.tmpdir();
        const inputPath = path.join(tempDir, `reencode_in_${Date.now()}.mp4`);
        const outputPath = path.join(tempDir, `reencode_out_${Date.now()}.mp4`);

        try {
            await fs.writeFile(inputPath, inputBuffer);

            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .outputOptions([
                        '-movflags +faststart',
                        '-pix_fmt yuv420p',
                        '-preset fast',
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
            context.log(`Re-encoded: ${inputBuffer.length} -> ${outputBuffer.length} bytes`);

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
                    originalSize: inputBuffer.length,
                    newSize: outputBuffer.length
                }
            };
        } finally {
            await fs.unlink(inputPath).catch(() => {});
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
