const { StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require('@azure/storage-blob');
const { checkAuthorization } = require('../shared/auth');
const { getContainerClient } = require('../shared/storage');
const { query } = require('../shared/db');

let ffmpeg = null;
try {
    ffmpeg = require('fluent-ffmpeg');
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    ffmpeg.setFfmpegPath(ffmpegPath);
} catch (err) {
    // fluent-ffmpeg is optional — scan will report unavailable if missing
}

module.exports = async function (context, req) {
    context.res = { status: 200, body: { alive: true } };
};

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

async function probeCodec(sasUrl) {
    return new Promise((resolve) => {
        // 8s per video; caller batches 5 at a time → max ~40s per page, safely under SWA 45s limit
        const timer = setTimeout(() => resolve({ codec: 'timeout' }), 8000);
        ffmpeg.ffprobe(sasUrl, (err, data) => {
            clearTimeout(timer);
            if (err) { resolve({ codec: 'error', detail: err.message }); return; }
            const stream = data.streams?.find(s => s.codec_type === 'video');
            resolve({ codec: stream?.codec_name || 'unknown' });
        });
    });
}

module.exports = async function (context, req) {
    try {
        const { authorized } = await checkAuthorization(context, 'Admin');
        if (!authorized) {
            context.res = { status: 403, body: { error: 'Admin access required' } };
            return;
        }

        if (!ffmpeg) {
            context.res = { status: 200, body: { success: false, error: 'FFmpeg not available' } };
            return;
        }

        const offset = parseInt(req.query.offset) || 0;
        const PAGE = 10; // 2 batches of 5, ~16s max → well under SWA 45s limit

        const allVideos = await query(
            `SELECT PFileName, PBlobUrl FROM Pictures WHERE PType = 2 ORDER BY PDateEntered DESC`
        );
        const total = allVideos.length;
        const videos = allVideos.slice(offset, offset + PAGE);

        const containerName = process.env.AZURE_STORAGE_CONTAINER || 'family-album-media';
        const containerClient = getContainerClient();
        const hevc = [];
        const errors = [];
        let h264Count = 0;

        const BATCH = 5;
        for (let i = 0; i < videos.length; i += BATCH) {
            await Promise.all(videos.slice(i, i + BATCH).map(async (video) => {
                try {
                    const blobName = video.PBlobUrl.split(`/${containerName}/`)[1]?.split('?')[0];
                    if (!blobName) { errors.push({ file: video.PFileName, detail: 'Cannot parse blob URL' }); return; }
                    const sasUrl = generateReadSasUrl(containerClient.getBlobClient(blobName));
                    const { codec, detail } = await probeCodec(sasUrl);
                    if (codec === 'hevc' || codec === 'h265') {
                        hevc.push(video.PFileName);
                    } else if (codec === 'h264' || codec === 'avc') {
                        h264Count++;
                    } else {
                        errors.push({ file: video.PFileName, detail: detail || codec });
                    }
                } catch (err) {
                    errors.push({ file: video.PFileName, detail: err.message });
                }
            }));
        }

        const nextOffset = offset + PAGE;
        context.res = {
            status: 200,
            body: {
                success: true,
                total,
                offset,
                nextOffset: nextOffset < total ? nextOffset : null,
                h264Count,
                hevc,
                errors
            }
        };
    } catch (err) {
        context.log.error('Scan error:', err);
        context.res = { status: 200, body: { success: false, error: err.message } };
    }
};
