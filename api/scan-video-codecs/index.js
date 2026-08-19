const { checkAuthorization } = require('../shared/auth');
const { getBlobSasUrl } = require('../shared/storage');
const { query } = require('../shared/db');
const fetch = require('node-fetch');

// Detect codec by fetching only the first 64KB of the MP4 container (no ffprobe needed)
async function detectCodec(sasUrl, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(sasUrl, {
            headers: { 'Range': 'bytes=0-65535' },
            signal: controller.signal
        });
        if (!res.ok && res.status !== 206) return { codec: 'error', detail: `HTTP ${res.status}` };
        const buf = Buffer.from(await res.arrayBuffer());
        const codec = findCodecInBuffer(buf);
        if (codec) return { codec };

        // moov at end (non-faststart) — also check last 64KB
        const contentLength = parseInt(res.headers.get('content-range')?.split('/')[1] || '0');
        if (contentLength > 65536) {
            const tailRes = await fetch(sasUrl, {
                headers: { 'Range': `bytes=${contentLength - 65536}-` },
                signal: controller.signal
            });
            if (tailRes.ok || tailRes.status === 206) {
                const tailBuf = Buffer.from(await tailRes.arrayBuffer());
                const tailCodec = findCodecInBuffer(tailBuf);
                if (tailCodec) return { codec: tailCodec };
            }
        }
        return { codec: 'unknown' };
    } catch (err) {
        return { codec: 'error', detail: err.name === 'AbortError' ? 'timeout' : err.message };
    } finally {
        clearTimeout(timer);
    }
}

// Search MP4 box headers for known codec type identifiers
function findCodecInBuffer(buf) {
    const s = buf.toString('binary');
    if (s.includes('hev1') || s.includes('hvc1')) return 'hevc';
    if (s.includes('avc1')) return 'h264';
    return null;
}

module.exports = async function (context, req) {
    try {
        const { authorized } = await checkAuthorization(context, 'Admin');
        if (!authorized) {
            context.res = { status: 403, body: { error: 'Admin access required' } };
            return;
        }

        const offset = parseInt(req.query.offset) || 0;
        const PAGE = 10;

        const allVideos = await query(
            `SELECT PFileName, PBlobUrl FROM Pictures WHERE PType = 2 ORDER BY PDateEntered DESC`
        );
        const total = allVideos.length;
        const videos = allVideos.slice(offset, offset + PAGE);

        const containerName = process.env.AZURE_STORAGE_CONTAINER || 'family-album-media';
        const hevc = [];
        const errors = [];
        let h264Count = 0;

        const BATCH = 5;
        for (let i = 0; i < videos.length; i += BATCH) {
            await Promise.all(videos.slice(i, i + BATCH).map(async (video) => {
                try {
                    const cleanUrl = video.PBlobUrl.split('?')[0];
                    const blobName = new URL(cleanUrl).pathname.split('/').slice(2).join('/');
                    if (!blobName) { errors.push({ file: video.PFileName, detail: `Cannot parse: ${video.PBlobUrl}` }); return; }
                    const sasUrl = getBlobSasUrl(containerName, blobName, 10);
                    const { codec, detail } = await detectCodec(sasUrl);
                    if (codec === 'hevc') {
                        hevc.push(video.PFileName);
                    } else if (codec === 'h264') {
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
                sampleError: errors[0]?.detail || null,
                errors
            }
        };
    } catch (err) {
        context.log.error('Scan error:', err);
        context.res = { status: 200, body: { success: false, error: err.message } };
    }
};
