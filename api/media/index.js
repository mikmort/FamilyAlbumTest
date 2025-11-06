const { query, execute } = require('../shared/db');
const { blobExists, getContainerClient, uploadBlob, deleteBlob } = require('../shared/storage');
const { checkAuthorization } = require('../shared/auth');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Lock map to prevent concurrent thumbnail generation for the same file
const thumbnailGenerationLocks = new Map();

// Make sharp optional - only needed for thumbnail generation
let sharp = null;
try {
    sharp = require('sharp');
} catch (err) {
    console.warn('Sharp module not available - thumbnail generation disabled');
}

// Make ffmpeg optional - only needed for video thumbnail generation
let ffmpeg = null;
let ffmpegPath = null;
try {
    ffmpeg = require('fluent-ffmpeg');
    ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    ffmpeg.setFfmpegPath(ffmpegPath);
    console.log('✅ FFmpeg loaded successfully:', ffmpegPath);
    console.log('FFmpeg module version:', require('fluent-ffmpeg/package.json').version);
    console.log('FFmpeg installer version:', require('@ffmpeg-installer/ffmpeg/package.json').version);
} catch (err) {
    console.warn('⚠️ FFmpeg module not available - video thumbnail generation disabled:', err.message);
    console.warn('Error stack:', err.stack);
}

// Helper to acquire a lock for thumbnail generation (prevent concurrent generation of same file)
async function acquireThumbnailLock(filepath) {
    const maxWaitTime = 30000; // 30 second max wait
    const pollInterval = 100; // Check every 100ms
    const startTime = Date.now();
    
    while (thumbnailGenerationLocks.has(filepath)) {
        if (Date.now() - startTime > maxWaitTime) {
            console.warn(`⚠️ Timeout waiting for thumbnail lock on ${filepath}, proceeding anyway`);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    thumbnailGenerationLocks.set(filepath, true);
}

// Helper to release a lock
function releaseThumbnailLock(filepath) {
    thumbnailGenerationLocks.delete(filepath);
}

module.exports = async function (context, req) {
    // Check authorization for all endpoints
    // Read operations (GET) require 'Read' role
    // Write operations (POST, PUT, DELETE) require 'Full' role
    const method = req.method;
    const requiredRole = (method === 'GET') ? 'Read' : 'Full';
    
    const authResult = await checkAuthorization(context, requiredRole);
    if (!authResult.authorized) {
        context.res = {
            status: authResult.status,
            headers: { 'Content-Type': 'application/json' },
            body: { error: authResult.message }
        };
        return;
    }

    // Temporary debug endpoint: /api/media/debug/list
    if (req.url && req.url.startsWith('/api/media/debug/list')) {
        // Query all media items (limit to 100 for safety)
        const rows = await query('SELECT TOP 100 * FROM dbo.Pictures ORDER BY PFileName');
        // Transform as in main API
        const debugMedia = rows.map(item => {
            let blobPath = (item.PFileName || '').replace(/\\/g, '/').replace(/\/\//g, '/');
            blobPath = blobPath.split('/').map(s => s.trim()).join('/');
            const encodedBlobPath = blobPath.split('/').map(encodeURIComponent).join('/');
            return {
                PFileName: item.PFileName,
                PBlobUrl: `/api/media/${encodedBlobPath}`,
                PThumbnailUrl: item.PThumbnailUrl ? item.PThumbnailUrl : `/api/media/${encodedBlobPath}?thumbnail=true`
            };
        });
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: debugMedia
        };
        return;
    }
    // Log everything for debugging
    context.log('=== MEDIA API DEBUG ===');
    context.log('req.url:', req.url);
    context.log('req.method:', req.method);
    context.log('req.params:', JSON.stringify(req.params));
    context.log('req.query:', JSON.stringify(req.query));
    context.log('======================');
    
    context.log('Media API function processed a request.');
    
    // Health check endpoint
    if (req.url === '/api/media' && method === 'GET' && !filename) {
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                url: req.url,
                params: req.params,
                modules: {
                    sharp: {
                        available: sharp !== null,
                        version: sharp ? sharp.versions : null
                    },
                    ffmpeg: {
                        available: ffmpeg !== null,
                        path: ffmpegPath,
                        fluentVersion: ffmpeg ? require('fluent-ffmpeg/package.json').version : null,
                        staticVersion: ffmpegPath ? require('ffmpeg-static/package.json').version : null
                    }
                },
                platform: {
                    os: process.platform,
                    arch: process.arch,
                    nodeVersion: process.version
                }
            }
        };
        return;
    }
    
    // Extract filename from URL path: /api/media/{filename}
    // Filename can contain forward slashes (e.g., Events/Birthday/photo.jpg)
    // Support additional trailing segments like /tags, /tags/{id}, or /faces
    let filename = null;
    if (req.url) {
        context.log('RAW URL:', req.url);
        // Extract path without query string first
        const pathOnly = req.url.split('?')[0];
        context.log('PATH ONLY:', pathOnly);
        
        // Simple approach: remove /api/media/ prefix and /tags or /faces suffix
        if (pathOnly.startsWith('/api/media/')) {
            let tempPath = pathOnly.substring('/api/media/'.length);
            context.log('AFTER REMOVING PREFIX:', tempPath);
            
            // Remove /tags, /tags/{id}, or /faces from the end
            tempPath = tempPath.replace(/\/(?:tags(?:\/\d+)?|faces)$/, '');
            context.log('AFTER REMOVING SUFFIX:', tempPath);
            
            filename = decodeURIComponent(tempPath);
            // Normalize all backslashes to forward slashes
            filename = filename.replace(/\\/g, '/');
            context.log('DECODED AND NORMALIZED FILENAME:', filename);
        }
    }
    
    // Fallback to route params if URL parsing didn't work
    if (!filename && req.params && req.params.filename) {
        let paramFilename = req.params.filename;
        // Remove /tags, /tags/{id}, or /faces from the end
        paramFilename = paramFilename.replace(/\/(?:tags(?:\/\d+)?|faces)$/, '');
        filename = decodeURIComponent(paramFilename);
        context.log('FILENAME FROM PARAMS (after stripping suffix):', filename);
        if (filename === '' || filename === '/') {
            filename = null;
        }
    }

    // Use only PFileName for blob path lookup and API URL construction
    if (filename) {
    // Normalize any accidental double slashes
    filename = filename.replace(/\/\//g, '/');
    // Trim whitespace from each segment
    let parts = filename.split('/').map(s => s.trim());
    filename = parts.join('/');
    context.log('FINAL FILENAME FOR LOOKUP:', filename);
    }

    // Check if thumbnail is requested
    const thumbnail = req.query.thumbnail === 'true';
    const forceRegenerate = req.query.regenerate === 'true';

    context.log(`Method: ${method}, URL: ${req.url}, Filename: ${filename}, Thumbnail: ${thumbnail}, ForceRegenerate: ${forceRegenerate}`);

    try {
            // Helper to normalize file name strings for consistent in-memory lookup.
            // This only affects JS-level map keys and does not change database data.
            function normalizeFileName(fname) {
                if (!fname && fname !== '') return fname;
                let s = String(fname).replace(/\\/g, '/');
                // Try to decode percent-encodings safely; if decode fails, fall back to raw string
                try {
                    if (s.includes('%')) s = decodeURIComponent(s);
                } catch (e) {
                    // ignore decode errors
                }
                return s;
            }
        // Explicit debug route: /api/media/debug/namephoto-search?pattern=xxx
        // Returns up to 100 matching NamePhoto rows for the provided pattern (substring match).
        if (method === 'GET' && req.url && req.url.startsWith('/api/media/debug/namephoto-search')) {
            const qp = req.query && (req.query.pattern || req.query.p);
            if (!qp) {
                context.res = { status: 400, body: { error: 'Missing pattern query parameter' } };
                return;
            }
            const raw = String(qp);
            const pattern = `%${raw.replace(/\\/g, '/')}%`;
            context.log(`Debug route: searching NamePhoto for pattern "${pattern}"`);
            try {
                const rows = await query(`SELECT TOP 100 npFileName, npID FROM dbo.NamePhoto WHERE npFileName LIKE @pattern ORDER BY npFileName`, { pattern });
                context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { pattern, count: rows.length, rows } };
                return;
            } catch (err) {
                context.log.error('Error executing debug namephoto-search query:', err);
                context.res = { status: 500, body: { error: 'Debug namephoto-search failed', details: String(err) } };
                return;
            }
        }
        // Debug helper: return NamePhoto rows for a given filename when ?debugFile=... is supplied.
        // This is intentionally opt-in and only used for diagnosing filename matching issues.
        // Opt-in limited wildcard debug: ?debugWildcardLimited=substring will run a safe LIKE '%substring%' search
        // and return up to 100 matches. Use this to find whether NamePhoto contains a specific token.
        if (method === 'GET' && req.query && req.query.debugWildcardLimited) {
            const raw = req.query.debugWildcardLimited;
            const pattern = `%${String(raw).replace(/\\/g, '/')}%`;
            context.log(`Debug wildcard limited: searching NamePhoto for pattern "${pattern}"`);
            try {
                const rows = await query(
                    `SELECT TOP 100 npFileName, npID FROM dbo.NamePhoto WHERE npFileName LIKE @pattern ORDER BY npFileName`,
                    { pattern }
                );
                context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { raw, pattern, count: rows.length, rows } };
                return;
            } catch (err) {
                context.log.error('Error executing debug wildcard limited query:', err);
                context.res = { status: 500, body: { error: 'Debug wildcard limited query failed', details: String(err) } };
                return;
            }
        }

        if (method === 'GET' && req.query && req.query.debugFile) {
            const debugFileRaw = req.query.debugFile;
            const debugFile = String(debugFileRaw).replace(/\\/g, '/');
            context.log(`Debug: fetching NamePhoto rows for "${debugFile}" and variants`);

            // Try a few variants: as-provided, backslashes, forwardslashes, and URL-encoded filename
            const variants = new Set([
                debugFile,
                debugFile.replace(/\//g, '\\'),
                encodeURIComponent(debugFile).replace(/%2F/g, '/').replace(/'/g, '%27')
            ]);

            const params = {};
            const placeholders = [];
            Array.from(variants).forEach((v, i) => {
                params[`v${i}`] = v;
                placeholders.push(`@v${i}`);
            });

            const debugQuery = `SELECT npFileName, npID FROM dbo.NamePhoto WHERE npFileName IN (${placeholders.join(',')}) ORDER BY npFileName`;
            let debugRows = [];
            try {
                debugRows = await query(debugQuery, params);
            } catch (dErr) {
                context.log.error('Error executing NamePhoto debug query:', dErr);
                context.res = { status: 500, body: { error: 'Debug query failed', details: String(dErr) } };
                return;
            }

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { debugFileRaw, variants: Array.from(variants), rows: debugRows }
            };
            return;
        }
        // GET /api/media/{filename}?thumbnail=true - Get thumbnail (generate if needed)
        // GET /api/media/{filename} - Stream file directly from blob storage
        if (method === 'GET' && filename) {
            // The filename has been decoded from the URL
            // We need to find the actual blob, which might be stored with URL-encoded name or plain name
            let blobPath = filename;
            
            context.log(`Trying blob path: "${blobPath}"`);
            
            // Try multiple variations to handle inconsistent blob naming
            const pathsToTry = [
                blobPath, // Try as-is first
                `media/${blobPath}`, // Try with media/ prefix (for newly uploaded files)
            ];
            
            // If path contains special chars, try with encoded variations
            const pathParts = blobPath.split('/');
            const directory = pathParts.slice(0, -1).join('/');
            const filenamePart = pathParts[pathParts.length - 1];
            
            // Try with entire path encoded (directory AND filename)
            const fullyEncodedPath = pathParts.map(part => 
                encodeURIComponent(part).replace(/'/g, '%27')
            ).join('/');
            if (fullyEncodedPath !== blobPath) {
                pathsToTry.push(fullyEncodedPath);
            }
            
            // Add variation with spaces encoded only in filename
            if (filenamePart.includes(' ') && !filenamePart.includes('%20')) {
                const spacesEncoded = directory + (directory ? '/' : '') + filenamePart.replace(/ /g, '%20');
                pathsToTry.push(spacesEncoded);
            }
            
            // Add variation with full encoding (apostrophes AND spaces) in filename only
            // Note: encodeURIComponent doesn't encode apostrophes, so we do it manually
            // This handles blobs like "Devorah%27s%20Wedding%20003.jpg"
            const fullyEncoded = directory + (directory ? '/' : '') + 
                encodeURIComponent(filenamePart)
                    .replace(/%2F/g, '/')
                    .replace(/'/g, '%27');
            if (fullyEncoded !== blobPath && !pathsToTry.includes(fullyEncoded)) {
                pathsToTry.push(fullyEncoded);
            }
            
            let blobFound = false;
            let foundPath = null;
            
            for (const tryPath of pathsToTry) {
                context.log(`Checking: "${tryPath}"`);
                try {
                    if (await blobExists(tryPath)) {
                        blobFound = true;
                        foundPath = tryPath;
                        context.log(`Found at: "${tryPath}"`);
                        break;
                    }
                } catch (err) {
                    context.log.error(`Error checking blob "${tryPath}": ${err.message}`);
                }
            }
            
            if (blobFound) {
                blobPath = foundPath;
            }
            
            if (!blobFound) {
                context.res = {
                    status: 404,
                    body: { error: 'Media file not found in storage' }
                };
                return;
            }
            
            // If thumbnail requested, check if it exists
            // Use the actual found blob name (foundPath) for thumbnail operations
            if (thumbnail) {
                // Acquire lock to prevent concurrent generation of the same thumbnail
                await acquireThumbnailLock(foundPath);
                
                try {
                    // Use full path (including directory) to avoid conflicts with duplicate filenames
                    const thumbnailPath = `thumbnails/${foundPath}`;
                    const thumbnailExists = await blobExists(thumbnailPath);
                    
                    let shouldRegenerate = forceRegenerate;
                    
                    // If thumbnail exists, check if it's a placeholder (too small)
                    if (thumbnailExists && !forceRegenerate) {
                        context.log(`Thumbnail exists at ${thumbnailPath}, checking size...`);
                        const containerClient = getContainerClient();
                        const thumbnailBlobClient = containerClient.getBlobClient(thumbnailPath);
                        const properties = await thumbnailBlobClient.getProperties();
                        const thumbnailSize = properties.contentLength;
                        
                        context.log(`Existing thumbnail size: ${thumbnailSize} bytes`);
                        
                    // If thumbnail is less than 100 bytes, it's likely a placeholder - regenerate it
                    if (thumbnailSize < 100) {
                        context.log(`⚠️ Thumbnail is too small (${thumbnailSize} bytes), likely a placeholder. Regenerating...`);
                        shouldRegenerate = true;
                    }
                } else if (forceRegenerate) {
                    context.log('Force regenerate requested');
                }
                
                if (!thumbnailExists || shouldRegenerate) {
                    // Generate thumbnail from original file
                    context.log(`${shouldRegenerate ? 'Regenerating' : 'Generating'} thumbnail for ${foundPath}`);
                    
                    // We already know the original exists because blobFound is true
                    // Download original file using the found path
                    const containerClient = getContainerClient();
                    const originalBlobClient = containerClient.getBlobClient(foundPath);
                    const downloadResponse = await originalBlobClient.download();
                    
                    // Convert stream to buffer
                    const chunks = [];
                    for await (const chunk of downloadResponse.readableStreamBody) {
                        chunks.push(Buffer.from(chunk));
                    }
                    const originalBuffer = Buffer.concat(chunks);
                    
                    // Check if this is a video file
                    const fileExt = foundPath.toLowerCase().split('.').pop();
                    const videoExtensions = ['mp4', 'mov', 'avi', 'wmv', 'mpg', 'mpeg', 'flv'];
                    const isVideo = videoExtensions.includes(fileExt);
                    
                    if (isVideo && ffmpeg) {
                        // Extract video frame using ffmpeg
                        context.log(`Video file detected (${fileExt}), extracting frame with ffmpeg`);
                        context.log(`FFmpeg path: ${ffmpegPath}`);
                        context.log(`Original buffer size: ${originalBuffer.length} bytes`);
                        
                        try {
                            const thumbnailBuffer = await extractVideoFrame(originalBuffer, context);
                            context.log(`FFmpeg extraction successful, thumbnail buffer size: ${thumbnailBuffer.length} bytes`);
                            
                            // Resize the extracted frame using sharp if available
                            let finalThumbnail = thumbnailBuffer;
                            if (sharp) {
                                context.log(`Resizing thumbnail with sharp`);
                                finalThumbnail = await sharp(thumbnailBuffer)
                                    .resize(300, null, {
                                        fit: 'inside',
                                        withoutEnlargement: true
                                    })
                                    .jpeg({ quality: 80 })
                                    .toBuffer();
                                context.log(`Sharp resize successful, final size: ${finalThumbnail.length} bytes`);
                            }
                            
                            // Upload thumbnail to blob storage
                            context.log(`Uploading thumbnail to blob storage: ${thumbnailPath}`);
                            await uploadBlob(thumbnailPath, finalThumbnail, 'image/jpeg');
                            context.log(`✅ Video thumbnail generated and saved: ${thumbnailPath}`);
                            blobPath = thumbnailPath;
                        } catch (ffmpegError) {
                            context.log.error(`❌ Error extracting video frame: ${ffmpegError.message}`);
                            context.log.error(`FFmpeg error stack: ${ffmpegError.stack}`);
                            context.log.error(`FFmpeg error details:`, ffmpegError);
                            
                            // Fall back to a better video placeholder image (300x200 with play icon)
                            context.log.warn(`Falling back to video placeholder thumbnail`);
                            
                            // Create a simple SVG placeholder that will be recognizable
                            const placeholderSvg = `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
                                <rect width="300" height="200" fill="#1a1a1a"/>
                                <circle cx="150" cy="100" r="40" fill="rgba(255,255,255,0.8)"/>
                                <polygon points="140,85 140,115 165,100" fill="#1a1a1a"/>
                                <text x="150" y="160" font-family="Arial" font-size="14" fill="white" text-anchor="middle">Video Preview Unavailable</text>
                            </svg>`;
                            
                            const placeholderBuffer = Buffer.from(placeholderSvg);
                            await uploadBlob(thumbnailPath, placeholderBuffer, 'image/svg+xml');
                            context.log(`⚠️ Using placeholder SVG for video thumbnail: ${thumbnailPath}`);
                            blobPath = thumbnailPath;
                        }
                    } else if (isVideo && !ffmpeg) {
                        // FFmpeg not available, use placeholder
                        context.log(`Video file detected but ffmpeg not available, using placeholder`);
                        
                        // Create a simple SVG placeholder that will be recognizable
                        const placeholderSvg = `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
                            <rect width="300" height="200" fill="#1a1a1a"/>
                            <circle cx="150" cy="100" r="40" fill="rgba(255,255,255,0.8)"/>
                            <polygon points="140,85 140,115 165,100" fill="#1a1a1a"/>
                            <text x="150" y="160" font-family="Arial" font-size="14" fill="white" text-anchor="middle">Video Preview Unavailable</text>
                        </svg>`;
                        
                        const placeholderBuffer = Buffer.from(placeholderSvg);
                        await uploadBlob(thumbnailPath, placeholderBuffer, 'image/svg+xml');
                        context.log(`Placeholder SVG saved for video: ${thumbnailPath}`);
                        blobPath = thumbnailPath;
                    } else {
                        // Generate thumbnail using sharp for images (300px width, maintain aspect ratio)
                        if (sharp) {
                            try {
                                const thumbnailBuffer = await sharp(originalBuffer)
                                    .rotate() // Auto-rotate based on EXIF orientation
                                    .resize(300, null, {
                                        fit: 'inside',
                                        withoutEnlargement: true
                                    })
                                    .jpeg({ quality: 80 })
                                    .toBuffer();
                                
                                // Upload thumbnail to blob storage
                                await uploadBlob(thumbnailPath, thumbnailBuffer, 'image/jpeg');
                                context.log(`Thumbnail generated and saved: ${thumbnailPath}`);
                                
                                // Use the newly created thumbnail
                                blobPath = thumbnailPath;
                            } catch (sharpError) {
                                context.log.error(`Error generating thumbnail: ${sharpError.message}`);
                                context.log.error(`Sharp error stack: ${sharpError.stack}`);
                                // If thumbnail generation fails, use original
                                context.log('Falling back to original image');
                                blobPath = foundPath;
                            }
                        } else {
                            // Sharp not available, use original image
                            context.log.warn('Sharp module not available - cannot generate thumbnails, using original image');
                            blobPath = foundPath;
                        }
                    }
                } else {
                    // Thumbnail already exists, use it
                    context.log(`Using existing thumbnail: ${thumbnailPath}`);
                    blobPath = thumbnailPath;
                }
                } finally {
                    // Release the lock when done
                    releaseThumbnailLock(foundPath);
                }
            } else {
                // No thumbnail requested, use the found path
                blobPath = foundPath;
            }
            
            // At this point, blobPath contains the actual blob name (either original or thumbnail)
            context.log(`Downloading blob: "${blobPath}"`);
            
            try {
                // Get blob client
                const containerClient = getContainerClient();
                const blobClient = containerClient.getBlobClient(blobPath);
                
                context.log(`Attempting to download blob: "${blobPath}"`);
                
                // Download the blob to a buffer instead of streaming
                const downloadResponse = await blobClient.download();
                
                // Convert stream to buffer
                const chunks = [];
                for await (const chunk of downloadResponse.readableStreamBody) {
                    chunks.push(Buffer.from(chunk));
                }
                const buffer = Buffer.concat(chunks);
                
                context.log(`Downloaded ${buffer.length} bytes for ${blobPath}`);
                
                // Determine content type
                const contentType = downloadResponse.contentType || getContentType(blobPath);
                
                // For video files, add Accept-Ranges header to support seeking
                const isVideo = contentType && contentType.startsWith('video/');
                const headers = {
                    'Content-Type': contentType,
                    'Content-Disposition': `inline; filename="${blobPath.split('/').pop()}"`,
                    'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
                    'Content-Length': buffer.length.toString()
                };
                
                if (isVideo) {
                    headers['Accept-Ranges'] = 'bytes';
                    headers['Content-Range'] = `bytes 0-${buffer.length - 1}/${buffer.length}`;
                }
                
                // Return the buffer
                context.res = {
                    status: 200,
                    headers: headers,
                    body: buffer,
                    isRaw: true
                };
                return;
            } catch (downloadError) {
                context.log.error(`Error downloading blob "${blobPath}": ${downloadError.message}`);
                context.log.error(`Stack: ${downloadError.stack}`);
                context.res = {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        error: 'Error downloading media file',
                        details: downloadError.message,
                        stack: downloadError.stack,
                        blobPath
                    })
                };
                return;
            }
        }

        // GET /api/media - List all media with optional filters
        if (method === 'GET' && !filename) {
            context.log('Fetching media list with filters');
            context.log('Query params:', JSON.stringify(req.query));
            
            const peopleIds = req.query.peopleIds ? req.query.peopleIds.split(',').map(id => parseInt(id)) : [];
            const eventId = req.query.eventId ? parseInt(req.query.eventId) : null;
            const noPeople = req.query.noPeople === 'true';
            const sortOrder = req.query.sortOrder || 'desc';
            const exclusiveFilter = req.query.exclusiveFilter === 'true';

            context.log('Parsed filters:', { peopleIds, eventId, noPeople, sortOrder, exclusiveFilter });

            let mediaQuery = `
                SELECT DISTINCT p.*
                FROM dbo.Pictures p
            `;
            
            const whereClauses = [];
            const params = {};

            // Filter by people
            if (peopleIds.length > 0) {
                if (exclusiveFilter) {
                    // Exclusive "only these people" mode: photo must have ALL selected people and NO other people
                    // Check 1: All selected people must be tagged
                    peopleIds.forEach((id, i) => {
                        const paramName = `person${i}`;
                        params[paramName] = id;
                        whereClauses.push(`
                            EXISTS (
                                SELECT 1 FROM dbo.NamePhoto np 
                                INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                                WHERE np.npFileName = p.PFileName 
                                AND np.npID = @${paramName}
                                AND ne.neType = 'N'
                            )
                        `);
                    });
                    
                    // Check 2: NO other people can be tagged (only the selected ones)
                    const personPlaceholders = peopleIds.map((_, i) => `@person${i}`).join(',');
                    whereClauses.push(`
                        NOT EXISTS (
                            SELECT 1 FROM dbo.NamePhoto np 
                            INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                            WHERE np.npFileName = p.PFileName 
                            AND np.npID NOT IN (${personPlaceholders})
                            AND ne.neType = 'N'
                        )
                    `);
                } else {
                    // Inclusive mode: photo must have ALL selected people (and can have other people too)
                    // All selected people must be tagged
                    peopleIds.forEach((id, i) => {
                        const paramName = `person${i}`;
                        params[paramName] = id;
                        whereClauses.push(`
                            EXISTS (
                                SELECT 1 FROM dbo.NamePhoto np 
                                INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                                WHERE np.npFileName = p.PFileName 
                                AND np.npID = @${paramName}
                                AND ne.neType = 'N'
                            )
                        `);
                    });
                }
            }

            // Filter by event
            if (eventId) {
                whereClauses.push(`
                    EXISTS (
                        SELECT 1 FROM dbo.NamePhoto np 
                        INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                        WHERE np.npFileName = p.PFileName 
                        AND np.npID = @eventId
                        AND ne.neType = 'E'
                    )
                `);
                params.eventId = eventId;
            }

            // Filter for photos with no people
            // This includes photos with ONLY ID=1 ("No Tagged People") or truly no people tagged
            if (noPeople) {
                whereClauses.push(`
                    (
                        -- Option 1: Only tagged with ID=1 ("No Tagged People")
                        (p.PPeopleList = '1' AND p.PNameCount = 1)
                        OR
                        -- Option 2: Legacy photos with no tags at all
                        (
                            NOT EXISTS (
                                SELECT 1 FROM dbo.NamePhoto np 
                                INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                                WHERE np.npFileName = p.PFileName
                                AND ne.neType = 'N'
                            )
                            AND (p.PNameCount = 0 OR p.PNameCount IS NULL)
                        )
                    )
                `);
            }

            if (whereClauses.length > 0) {
                mediaQuery += ` WHERE ${whereClauses.join(' AND ')}`;
            }

            // Sorting
            const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
            mediaQuery += ` ORDER BY p.PYear ${orderDirection}, p.PMonth ${orderDirection}, p.PFileName ${orderDirection}`;

            context.log('Executing main media query...');
            context.log('Query:', mediaQuery);
            context.log('Params:', JSON.stringify(params));
            
            let media;
            try {
                media = await query(mediaQuery, params);
                context.log(`Found ${media.length} media items`);
            } catch (queryError) {
                context.log.error('Error executing main media query:', queryError);
                throw queryError;
            }

            // Build NameEvent lookup for all IDs in PPeopleList across all media.
            // PPeopleList contains comma-separated IDs that reference NameEvent records.
            // PPeopleList is the source of truth for people ordering.
            let eventLookup = {};
            let npEventLookup = {};

            if (media.length > 0) {
                // Collect all numeric IDs from PPeopleList across all media items
                const candidateIds = new Set();
                media.forEach(item => {
                    const ppl = item.PPeopleList || '';
                    if (!ppl) return;
                    const tokens = ppl.split(',').map(s => s.trim()).filter(Boolean);
                    tokens.forEach(tok => {
                        if (/^\d+$/.test(tok)) candidateIds.add(parseInt(tok));
                    });
                });

                // Also collect event IDs from NamePhoto table - ONLY if we're filtering by event
                // For general media lists, NamePhoto events are too expensive to query for all items
                if (eventId) {
                    // User is filtering by event, so NamePhoto events might be needed
                    // But eventId is already used in the WHERE clause for the main query
                    // so we don't need to do additional NamePhoto queries here
                    context.log(`Event filter requested (eventId=${eventId}), relying on query WHERE clause for NamePhoto events`);
                }

                // Batch query NameEvent for all candidate IDs
                if (candidateIds.size > 0) {
                    const ids = Array.from(candidateIds);
                    const idPlaceholders = ids.map((_, i) => `@id${i}`).join(',');
                    const eventQuery = `SELECT ID, neName, neRelation, neType FROM dbo.NameEvent WHERE ID IN (${idPlaceholders})`;
                    const eventParams = {};
                    ids.forEach((id, i) => { eventParams[`id${i}`] = id; });
                    
                    try {
                        context.log(`Fetching NameEvent records for ${ids.length} IDs from PPeopleList and NamePhoto...`);
                        const eventRows = await query(eventQuery, eventParams);
                        context.log(`Found ${eventRows.length} NameEvent records`);
                        eventRows.forEach(r => {
                            eventLookup[r.ID] = { ID: r.ID, neName: r.neName, neType: r.neType, neRelation: r.neRelation };
                        });
                    } catch (evErr) {
                        context.log.error('Error querying NameEvent IDs:', evErr);
                        throw evErr;
                    }
                }

                // Build NamePhoto event lookup for individual media items
                // Query NamePhoto for event associations (neType = 'E')
                
                try {
                    context.log('Querying NamePhoto for event associations...');
                    // Get all filenames from our media results
                    const filenames = media.map(m => m.PFileName).filter(Boolean);
                    
                    if (filenames.length > 0) {
                        // Query NamePhoto with both forward and backslash variants
                        const npParams = {};
                        const placeholders = [];
                        
                        filenames.forEach((fn, i) => {
                            npParams[`fn${i}`] = fn;
                            placeholders.push(`@fn${i}`);
                            
                            // Also try backslash variant
                            const backslashVariant = fn.replace(/\//g, '\\');
                            if (backslashVariant !== fn) {
                                npParams[`fn${i}_bs`] = backslashVariant;
                                placeholders.push(`@fn${i}_bs`);
                            }
                        });
                        
                        const npQuery = `
                            SELECT DISTINCT np.npFileName, np.npID
                            FROM dbo.NamePhoto np
                            INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                            WHERE ne.neType = 'E'
                            AND np.npFileName IN (${placeholders.join(',')})
                        `;
                        
                        const npRows = await query(npQuery, npParams);
                        context.log(`Found ${npRows.length} NamePhoto event associations`);
                        
                        // Add these event IDs to candidateIds so they get looked up in NameEvent
                        const npEventIds = new Set();
                        
                        npRows.forEach(row => {
                            // Normalize the filename to use forward slashes as key
                            const normalizedFilename = row.npFileName.replace(/\\/g, '/');
                            npEventLookup[normalizedFilename] = row.npID;
                            // Also store with backslash variant as key
                            npEventLookup[row.npFileName] = row.npID;
                            // Collect event IDs
                            npEventIds.add(row.npID);
                        });
                        
                        // Query NameEvent for these event IDs if not already in eventLookup
                        if (npEventIds.size > 0) {
                            const missingEventIds = Array.from(npEventIds).filter(id => !eventLookup[id]);
                            if (missingEventIds.length > 0) {
                                const eventIdPlaceholders = missingEventIds.map((_, i) => `@eid${i}`).join(',');
                                const eventQuery = `SELECT ID, neName, neRelation, neType FROM dbo.NameEvent WHERE ID IN (${eventIdPlaceholders})`;
                                const eventParams = {};
                                missingEventIds.forEach((id, i) => { eventParams[`eid${i}`] = id; });
                                
                                const eventRows = await query(eventQuery, eventParams);
                                context.log(`Fetched ${eventRows.length} NameEvent records for NamePhoto events`);
                                eventRows.forEach(r => {
                                    eventLookup[r.ID] = { ID: r.ID, neName: r.neName, neType: r.neType, neRelation: r.neRelation };
                                });
                            }
                        }
                    }
                } catch (npErr) {
                    context.log.error('Error querying NamePhoto for events:', npErr);
                    // Continue without event data rather than failing completely
                }
            }

            // Transform results to construct proper blob URLs
            // Combine PFileDirectory and PFileName to get the full blob path
            context.log('Transforming media results with blob URLs...');
            
            let transformedMedia;
            try {
                transformedMedia = media.map(item => {
                    // Always use only PFileName for blob path and API URL construction
                    let blobPath = (item.PFileName || '').replace(/\\/g, '/').replace(/\/\//g, '/');
                    // Trim whitespace from each segment
                    blobPath = blobPath.split('/').map(s => s.trim()).join('/');
                    // The database stores filenames that match blob storage exactly
                    // Some blob names have URL-encoded characters (%27, %20) as part of the blob name
                    // Don't encode again - use the blob path as-is
                    
                    // Determine event from PPeopleList by searching numeric tokens in order and
                    // picking the first one that actually maps to an event (neType === 'E').
                    let eventForItem = null;
                    if (item.PPeopleList) {
                        const tokens = item.PPeopleList.split(',').map(s => s.trim()).filter(Boolean);
                        const numericIds = tokens.filter(tok => /^\d+$/.test(tok)).map(tok => parseInt(tok));
                        for (const id of numericIds) {
                            const lookup = eventLookup[id];
                            if (lookup && lookup.neType === 'E') {
                                eventForItem = { ID: lookup.ID, neName: lookup.neName };
                                break;
                            }
                        }
                    }
                    
                    // If no event found in PPeopleList, check the NamePhoto event lookup that was built earlier
                    if (!eventForItem && item.PFileName && npEventLookup[item.PFileName]) {
                        const npEventId = npEventLookup[item.PFileName];
                        const eventLookupData = eventLookup[npEventId];
                        if (eventLookupData) {
                            eventForItem = { ID: eventLookupData.ID, neName: eventLookupData.neName };
                        }
                    }

                    // Build TaggedPeople strictly from PPeopleList order.
                    // PPeopleList contains comma-separated IDs that map to NameEvent records (source of truth).
                    // Only include people (neType === 'N'); events (neType === 'E') are displayed separately.
                    let orderedTagged = [];

                    if (item.PPeopleList) {
                        const tokens = item.PPeopleList.split(',').map(s => s.trim()).filter(Boolean);

                        for (const tok of tokens) {
                            if (!tok) continue;

                            // All tokens in PPeopleList are numeric IDs
                            if (/^\d+$/.test(tok)) {
                                const id = parseInt(tok, 10);
                                const lookup = eventLookup[id];
                                
                                // Only add people (neType === 'N'), exclude events (neType === 'E')
                                if (lookup && lookup.neType === 'N') {
                                    orderedTagged.push({
                                        ID: lookup.ID,
                                        neName: lookup.neName,
                                        neRelation: lookup.neRelation
                                    });
                                }
                            }
                        }
                    }

                    // Use stored PThumbnailUrl if available, otherwise generate on-demand URL
                    // PThumbnailUrl is a pre-generated thumbnail URL stored in the database
                    // If it's empty, fall back to on-demand generation via ?thumbnail=true
                    // URL encode the blob path for use in the API endpoint
                    const encodedBlobPath = blobPath.split('/').map(encodeURIComponent).join('/');
                    const thumbnailUrl = item.PThumbnailUrl 
                        ? item.PThumbnailUrl 
                        : `/api/media/${encodedBlobPath}?thumbnail=true`;

                    return {
                        ...item,
                        PBlobUrl: `/api/media/${encodedBlobPath}`,
                        PThumbnailUrl: thumbnailUrl,
                        TaggedPeople: orderedTagged,
                        Event: eventForItem
                    };
                });
                context.log(`Transformed ${transformedMedia.length} media items successfully`);
            } catch (transformError) {
                context.log.error('Error transforming media results:', transformError);
                throw transformError;
            }

            // Log each media item for debugging
            transformedMedia.forEach(item => {
                context.log(`[MEDIA DEBUG] PFileName: ${item.PFileName}`);
                context.log(`[MEDIA DEBUG] PBlobUrl: ${item.PBlobUrl}`);
                context.log(`[MEDIA DEBUG] PThumbnailUrl: ${item.PThumbnailUrl}`);
            });

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: transformedMedia
            };
            context.log('Media list response sent successfully');
            return;
        }

        // GET /api/media/{filename}/faces - Get face detections for an image
        if (method === 'GET' && filename && req.url && req.url.includes('/faces')) {
            context.log('Getting face detections for:', filename);
            
            try {
                const facesQuery = `
                    SELECT 
                        f.FaceID,
                        f.PersonID,
                        ne.NName as SuggestedPersonName,
                        f.BoundingBox,
                        f.Confidence,
                        f.Distance,
                        f.IsConfirmed,
                        f.IsRejected,
                        f.CreatedDate
                    FROM dbo.FaceEncodings f
                    LEFT JOIN dbo.NameEvent ne ON f.PersonID = ne.NameID
                    WHERE f.PFileName = @filename
                    ORDER BY f.Confidence DESC
                `;
                
                const faces = await query(facesQuery, { filename });
                
                // Parse bounding boxes from JSON
                faces.forEach(face => {
                    if (face.BoundingBox) {
                        try {
                            face.BoundingBox = JSON.parse(face.BoundingBox);
                        } catch (e) {
                            context.log.warn('Failed to parse bounding box:', e);
                        }
                    }
                });
                
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: { success: true, faces }
                };
                return;
            } catch (error) {
                context.log.error('Failed to get face detections:', error);
                context.res = {
                    status: 500,
                    body: { error: 'Failed to get face detections' }
                };
                return;
            }
        }

        // POST /api/media/{filename}/tags - Tag a person in a photo
        if (method === 'POST' && filename) {
            const { personId, position } = req.body;

            context.log('=== TAG PERSON REQUEST ===');
            context.log('Raw URL:', req.url);
            context.log('Decoded filename:', filename);
            context.log('Filename length:', filename.length);
            context.log('Filename bytes:', Buffer.from(filename).toString('hex'));
            context.log('PersonId:', personId);
            context.log('Position:', position);
            context.log('Request body:', JSON.stringify(req.body));

            if (!personId) {
                context.res = {
                    status: 400,
                    body: { error: 'Person ID is required' }
                };
                return;
            }

            try {
                // First, let's check if ANY pictures exist
                context.log('Checking if Pictures table has any records...');
                try {
                    const countQuery = `SELECT COUNT(*) as cnt FROM dbo.Pictures`;
                    const countResult = await query(countQuery, {});
                    context.log('Count query executed');
                    context.log('Count result type:', typeof countResult);
                    context.log('Count result is array:', Array.isArray(countResult));
                    context.log('Count result length:', countResult ? countResult.length : 'undefined');
                    context.log('Full count result:', JSON.stringify(countResult));
                    
                    if (!countResult || !Array.isArray(countResult) || countResult.length === 0) {
                        context.log.error('❌ Count query returned invalid result');
                        context.res = {
                            status: 500,
                            body: { 
                                error: 'Database query failed - COUNT query returned no results',
                                countResultType: typeof countResult
                            }
                        };
                        return;
                    }
                    
                    const totalCount = countResult[0].cnt;
                    context.log('✅ Total pictures in database:', totalCount);
                } catch (countError) {
                    context.log.error('❌ Error executing COUNT query:', countError.message);
                    context.res = {
                        status: 500,
                        body: { 
                            error: 'Failed to count pictures',
                            details: countError.message
                        }
                    };
                    return;
                }
                
                // Get current picture to access PPeopleList
                // Try both forward and backslash versions since database might have either
                const filenameWithBackslash = filename.replace(/\//g, '\\');
                const pictureQuery = `
                    SELECT PFileName, PPeopleList, PNameCount
                    FROM dbo.Pictures
                    WHERE PFileName = @filename OR PFileName = @filenameAlt
                `;
                context.log('Executing picture query for filename:', filename);
                context.log('Also trying with backslashes:', filenameWithBackslash);
                context.log('Query:', pictureQuery);
                const pictures = await query(pictureQuery, { 
                    filename: filename,
                    filenameAlt: filenameWithBackslash 
                });
                context.log('Query returned', pictures ? pictures.length : 'null', 'results');
                
                if (!pictures || pictures.length === 0) {
                    context.log.error('❌ Picture not found for filename:', filename);
                    
                    // Try to find similar filenames
                    context.log('Searching for similar filenames...');
                    const searchQuery = `
                        SELECT TOP 5 PFileName 
                        FROM dbo.Pictures 
                        WHERE PFileName LIKE @pattern
                        ORDER BY PFileName
                    `;
                    const searchPattern = '%' + filename.split('/').pop() + '%';
                    const similar = await query(searchQuery, { pattern: searchPattern });
                    context.log('Similar files found:', similar ? similar.length : 0);
                    if (similar && similar.length > 0) {
                        context.log('Sample similar filenames:', similar.map(s => s.PFileName));
                    }
                    
                    context.res = {
                        status: 404,
                        body: { 
                            error: 'Picture not found',
                            searchedFor: filename,
                            similarFilesFound: similar ? similar.length : 0
                        }
                    };
                    return;
                }

                const picture = pictures[0];
                context.log('✅ Picture found!');
                context.log('Picture object:', JSON.stringify(picture));
                
                if (!picture) {
                    context.log.error('❌ Picture object is null/undefined');
                    context.res = {
                        status: 500,
                        body: { error: 'Picture object is null or undefined' }
                    };
                    return;
                }
                
                context.log('Current picture data:');
                context.log('  PFileName:', picture.PFileName);
                context.log('  PPeopleList:', picture.PPeopleList);
                context.log('  PNameCount:', picture.PNameCount);
                
                // Parse current PPeopleList - handle null/undefined
                const peopleListStr = picture.PPeopleList || '';
                const currentPeopleIds = peopleListStr 
                    ? peopleListStr.split(',').map(s => s.trim()).filter(Boolean).map(s => parseInt(s, 10))
                    : [];
                context.log('Parsed people IDs:', currentPeopleIds);
                
                // Check if person is already tagged
                if (currentPeopleIds.includes(personId)) {
                    context.log.warn(`⚠️ Person ${personId} already tagged in ${filename}`);
                    context.res = {
                        status: 409,
                        body: { error: 'This person is already tagged in this photo' }
                    };
                    return;
                }
                
                const insertPos = position || 0;
                const clampedPos = Math.max(0, Math.min(insertPos, currentPeopleIds.length));
                context.log('Insert position:', clampedPos);
                
                // Check if this is the first real person being tagged (currently only has ID=1 "No Tagged People")
                const isCurrentlyUntagged = currentPeopleIds.length === 1 && currentPeopleIds[0] === 1;
                
                if (isCurrentlyUntagged) {
                    context.log('First real person being tagged, will remove "No Tagged People" (ID=1)');
                    // Remove ID=1 and replace with the new person
                    currentPeopleIds[0] = personId;
                } else {
                    // Insert the new person at the specified position
                    currentPeopleIds.splice(clampedPos, 0, personId);
                }
                context.log('New people IDs after insert:', currentPeopleIds);

                // Use the actual filename from database (with backslashes) for all DB operations
                const dbFileName = picture.PFileName;
                context.log('Using database filename for operations:', dbFileName);
                
                // Check if NamePhoto record already exists (shouldn't happen if UI is correct)
                const checkQuery = `
                    SELECT COUNT(*) as cnt FROM dbo.NamePhoto
                    WHERE npFileName = @filename AND npID = @personId
                `;
                context.log('Checking for existing NamePhoto record...');
                const checkResult = await query(checkQuery, { filename: dbFileName, personId });
                context.log('Check result:', JSON.stringify(checkResult));
                
                if (!checkResult || !Array.isArray(checkResult) || checkResult.length === 0) {
                    context.log.error('❌ Check query returned invalid result');
                    context.res = {
                        status: 500,
                        body: { error: 'Database check failed' }
                    };
                    return;
                }
                
                context.log('Existing NamePhoto records:', checkResult[0].cnt);
                
                // If this is the first real person being tagged, remove "No Tagged People" (ID=1)
                if (isCurrentlyUntagged) {
                    context.log('Removing "No Tagged People" (ID=1) from NamePhoto...');
                    const deleteNoTagQuery = `
                        DELETE FROM dbo.NamePhoto
                        WHERE npFileName = @filename AND npID = 1
                    `;
                    await execute(deleteNoTagQuery, { filename: dbFileName });
                    
                    // Update neCount for "No Tagged People"
                    await execute(`
                        UPDATE NameEvent
                        SET neCount = (
                            SELECT COUNT(*)
                            FROM NamePhoto
                            WHERE npID = 1
                        )
                        WHERE ID = 1
                    `);
                    context.log('✅ Removed "No Tagged People" tag');
                }
                
                if (checkResult[0].cnt === 0) {
                    // Insert the NamePhoto record
                    const insertQuery = `
                        INSERT INTO dbo.NamePhoto (npFileName, npID)
                        VALUES (@filename, @personId)
                    `;
                    context.log('Inserting NamePhoto record...');
                    await execute(insertQuery, {
                        filename: dbFileName,
                        personId
                    });
                    context.log('✅ NamePhoto record inserted');
                } else {
                    context.log('⚠️ NamePhoto record already exists, skipping insert');
                }

                // Update PPeopleList and PNameCount in Pictures table
                const newPeopleList = currentPeopleIds.join(',');
                context.log('New PPeopleList:', newPeopleList);
                context.log('New PNameCount:', currentPeopleIds.length);
                
                const updatePictureQuery = `
                    UPDATE dbo.Pictures
                    SET PPeopleList = @peopleList,
                        PNameCount = @nameCount,
                        PLastModifiedDate = GETDATE()
                    WHERE PFileName = @filename
                `;
                context.log('Updating Pictures table...');
                await execute(updatePictureQuery, {
                    filename: dbFileName,
                    peopleList: newPeopleList,
                    nameCount: currentPeopleIds.length
                });
                context.log('✅ Pictures table updated');

                context.log('=== TAG PERSON SUCCESS ===');
                context.res = {
                    status: 201,
                    body: { success: true, peopleList: newPeopleList, nameCount: currentPeopleIds.length }
                };
            } catch (error) {
                context.log.error('❌ Error tagging person:');
                context.log.error('  Message:', error.message);
                context.log.error('  Stack:', error.stack);
                context.log.error('  Full error:', error);
                context.res = {
                    status: 500,
                    body: { 
                        error: error.message || 'Failed to tag person',
                        details: error.message,
                        stack: error.stack
                    }
                };
            }
            return;
        }

        // DELETE /api/media/{filename}/tags/{personId} - Remove person tag
        // Only match if URL contains /tags/ pattern
        if (method === 'DELETE' && filename && req.url && req.url.includes('/tags/')) {
            const { personId } = req.body;

            if (!personId) {
                context.res = {
                    status: 400,
                    body: { error: 'Person ID is required' }
                };
                return;
            }

            try {
                // First, find the picture with either slash format
                const filenameWithBackslash = filename.replace(/\//g, '\\');
                const findQuery = `
                    SELECT PFileName, PPeopleList, PNameCount
                    FROM dbo.Pictures
                    WHERE PFileName = @filename OR PFileName = @filenameAlt
                `;
                const pictures = await query(findQuery, { 
                    filename: filename,
                    filenameAlt: filenameWithBackslash 
                });
                
                if (!pictures || pictures.length === 0) {
                    context.res = {
                        status: 404,
                        body: { error: 'Picture not found' }
                    };
                    return;
                }

                const picture = pictures[0];
                // Use the actual database filename for all operations
                const dbFileName = picture.PFileName;
                context.log('Found database filename:', dbFileName);
                
                // Parse current PPeopleList
                const currentPeopleIds = picture.PPeopleList 
                    ? picture.PPeopleList.split(',').map(s => s.trim()).filter(Boolean).map(s => parseInt(s, 10))
                    : [];
                
                // Check if person is in the list
                const personIndex = currentPeopleIds.indexOf(personId);
                if (personIndex === -1) {
                    context.res = {
                        status: 404,
                        body: { error: 'Person tag not found' }
                    };
                    return;
                }

                // Delete the person tag from NamePhoto
                const deleteQuery = `
                    DELETE FROM dbo.NamePhoto
                    WHERE npFileName = @filename AND npID = @personId
                `;
                await execute(deleteQuery, { filename: dbFileName, personId });

                // Remove person from the list
                currentPeopleIds.splice(personIndex, 1);
                
                // If no people left, add "No Tagged People" (ID=1)
                let newPeopleList;
                let newNameCount;
                
                if (currentPeopleIds.length === 0) {
                    context.log('Last person removed, adding "No Tagged People" (ID=1)');
                    newPeopleList = '1';
                    newNameCount = 1;
                    
                    // Insert "No Tagged People" into NamePhoto
                    await execute(`
                        INSERT INTO NamePhoto (npID, npFileName, npPosition)
                        VALUES (1, @filename, 0)
                    `, { filename: dbFileName });
                    
                    // Update neCount for "No Tagged People"
                    await execute(`
                        UPDATE NameEvent
                        SET neCount = (
                            SELECT COUNT(*)
                            FROM NamePhoto
                            WHERE npID = 1
                        )
                        WHERE ID = 1
                    `);
                } else {
                    newPeopleList = currentPeopleIds.join(',');
                    newNameCount = currentPeopleIds.length;
                }
                
                // Update PPeopleList and PNameCount in Pictures table
                const updatePictureQuery = `
                    UPDATE dbo.Pictures
                    SET PPeopleList = @peopleList,
                        PNameCount = @nameCount,
                        PLastModifiedDate = GETDATE()
                    WHERE PFileName = @filename
                `;
                await execute(updatePictureQuery, {
                    filename: dbFileName,
                    peopleList: newPeopleList,
                    nameCount: newNameCount
                });

                context.res = {
                    status: 200,
                    body: { success: true, peopleList: newPeopleList, nameCount: newNameCount }
                };
            } catch (error) {
                context.log('❌ Error removing person tag:', error);
                context.res = {
                    status: 500,
                    body: { error: error.message || 'Failed to remove person tag' }
                };
            }
            return;
        }

        // PATCH /api/media/{filename} - Update media metadata
        if (method === 'PATCH' && filename) {
            const { description, month, year, eventID } = req.body;

            context.log('Updating media:', filename);
            context.log('Update data:', { description, month, year, eventID });

            // First, find the picture with either slash format
            const filenameWithBackslash = filename.replace(/\//g, '\\');
            const findQuery = `
                SELECT PFileName
                FROM dbo.Pictures
                WHERE PFileName = @filename OR PFileName = @filenameAlt
            `;
            const findResult = await query(findQuery, { 
                filename: filename,
                filenameAlt: filenameWithBackslash 
            });
            
            if (!findResult || findResult.length === 0) {
                context.res = {
                    status: 404,
                    body: { error: 'Media not found' }
                };
                return;
            }
            
            // Use the actual database filename for the update
            const dbFileName = findResult[0].PFileName;
            context.log('Found database filename:', dbFileName);

            // Build update query dynamically based on provided fields
            const updates = [];
            const params = { filename: dbFileName };

            if (description !== undefined) {
                updates.push('PDescription = @description');
                params.description = description || null;
            }

            if (month !== undefined) {
                updates.push('PMonth = @month');
                params.month = month || null;
            }

            if (year !== undefined) {
                updates.push('PYear = @year');
                params.year = year || null;
            }

            // Handle event updates
            let eventChanged = false;
            if (eventID !== undefined) {
                context.log('Processing event update:', { currentEventID: eventID });
                
                // Get current event for this photo (events have neType='E')
                const currentEventQuery = `
                    SELECT np.npID
                    FROM dbo.NamePhoto np
                    INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                    WHERE np.npFileName = @filename AND ne.neType = 'E'
                `;
                const currentEventResult = await query(currentEventQuery, { filename: dbFileName });
                const currentEventID = currentEventResult.length > 0 ? currentEventResult[0].npID : null;
                
                context.log('Current event ID:', currentEventID, 'New event ID:', eventID);

                // If event changed, update NamePhoto table
                if (currentEventID !== eventID) {
                    eventChanged = true;
                    
                    // Remove old event if exists
                    if (currentEventID) {
                        const deleteEventQuery = `
                            DELETE FROM dbo.NamePhoto
                            WHERE npFileName = @filename AND npID = @eventID
                        `;
                        await execute(deleteEventQuery, { filename: dbFileName, eventID: currentEventID });
                        context.log('Removed old event:', currentEventID);
                    }
                    
                    // Add new event if provided
                    if (eventID) {
                        // Verify the event exists and is type 'E'
                        const eventCheckQuery = `
                            SELECT ID FROM dbo.NameEvent WHERE ID = @eventID AND neType = 'E'
                        `;
                        const eventCheck = await query(eventCheckQuery, { eventID });
                        
                        if (eventCheck.length === 0) {
                            context.res = {
                                status: 400,
                                body: { error: 'Invalid event ID' }
                            };
                            return;
                        }
                        
                        const insertEventQuery = `
                            INSERT INTO dbo.NamePhoto (npID, npFileName)
                            VALUES (@eventID, @filename)
                        `;
                        await execute(insertEventQuery, { eventID, filename: dbFileName });
                        context.log('Added new event:', eventID);
                    }
                }
            }

            if (updates.length === 0 && !eventChanged) {
                context.res = {
                    status: 400,
                    body: { error: 'No fields to update' }
                };
                return;
            }

            if (updates.length > 0) {
                updates.push('PLastModifiedDate = GETDATE()');

                const updateQuery = `
                    UPDATE dbo.Pictures
                    SET ${updates.join(', ')}
                    WHERE PFileName = @filename
                `;

                context.log('Executing update query:', updateQuery);
                context.log('With params:', params);
                
                await execute(updateQuery, params);
            }

            // Fetch updated record to return
            const selectQuery = `
                SELECT 
                    PFileName,
                    PFileDirectory,
                    PDescription,
                    PMonth,
                    PYear,
                    PBlobUrl,
                    PThumbnailUrl,
                    PType,
                    PWidth,
                    PHeight,
                    PTime,
                    PPeopleList,
                    PNameCount
                FROM dbo.Pictures
                WHERE PFileName = @filename
            `;

            const result = await query(selectQuery, { filename: dbFileName });
            
            if (result.length === 0) {
                context.res = {
                    status: 404,
                    body: { error: 'Media not found after update' }
                };
                return;
            }

            context.res = {
                status: 200,
                body: {
                    success: true,
                    media: result[0]
                }
            };
            return;
        }

        // DELETE /api/media/{filename} - Delete media file completely
        if (method === 'DELETE' && filename) {
            context.log('=== DELETE REQUEST ===');
            context.log('Deleting media:', filename);

            try {
                // First, find the picture with either slash format
                const filenameWithBackslash = filename.replace(/\//g, '\\');
                context.log('Searching for:', filename, 'OR', filenameWithBackslash);
                
                const findQuery = `
                    SELECT PFileName, PBlobUrl, PThumbnailUrl
                    FROM dbo.Pictures
                    WHERE PFileName = @filename OR PFileName = @filenameAlt
                `;
                
                context.log('Executing find query...');
                const findResult = await query(findQuery, { 
                    filename: filename,
                    filenameAlt: filenameWithBackslash 
                });
                
                context.log('Find result:', findResult ? findResult.length : 'null', 'rows');
                
                if (!findResult || findResult.length === 0) {
                    context.log('❌ File not found in database');
                    context.res = {
                        status: 404,
                        body: { error: 'Media file not found in database' }
                    };
                    return;
                }
                
                const picture = findResult[0];
                const dbFileName = picture.PFileName;
                context.log('Found database filename:', dbFileName);
                context.log('Blob URL:', picture.PBlobUrl);
                context.log('Thumbnail URL:', picture.PThumbnailUrl);

                // Extract blob paths from URLs
                // URLs look like: https://account.blob.core.windows.net/container/media/filename.jpg
                // We need just: media/filename.jpg
                const extractBlobPath = (url) => {
                    if (!url) return null;
                    
                    // If it's a full URL, extract the path after the container name
                    if (url.includes('blob.core.windows.net')) {
                        const parts = url.split('/');
                        // Find 'media' or similar container path
                        const mediaIndex = parts.findIndex(p => p === 'media' || p.startsWith('media/'));
                        if (mediaIndex !== -1) {
                            return parts.slice(mediaIndex).join('/');
                        }
                        // Fallback: take everything after the container (4th slash)
                        const afterDomain = url.split('.blob.core.windows.net/')[1];
                        if (afterDomain) {
                            // Skip container name, get the rest
                            const pathParts = afterDomain.split('/');
                            if (pathParts.length > 1) {
                                return pathParts.slice(1).join('/');
                            }
                        }
                    }
                    
                    // If not a full URL, might already be just the filename
                    return url;
                };

                const blobPath = extractBlobPath(picture.PBlobUrl);
                const thumbBlobPath = extractBlobPath(picture.PThumbnailUrl);

                context.log('Extracted blob path:', blobPath);
                context.log('Extracted thumb path:', thumbBlobPath);

                // Also try to construct thumbnail path from main filename as fallback
                let constructedThumbPath = null;
                if (blobPath && blobPath.includes('/')) {
                    const pathParts = blobPath.split('/');
                    const filename = pathParts[pathParts.length - 1];
                    const filenameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
                    constructedThumbPath = `media/thumb_${filenameWithoutExt}.jpg`;
                    context.log('Constructed thumb path:', constructedThumbPath);
                }

                // Delete from blob storage
                let blobDeleted = false;
                let thumbDeleted = false;

                if (blobPath) {
                    try {
                        await deleteBlob(blobPath);
                        blobDeleted = true;
                        context.log('✅ Deleted main blob:', blobPath);
                    } catch (blobError) {
                        context.log.warn('⚠️ Failed to delete main blob:', blobError.message);
                        // Continue anyway - file might not exist in storage
                    }
                }

                // Try deleting thumbnail using database path
                if (thumbBlobPath && thumbBlobPath !== blobPath) {
                    try {
                        await deleteBlob(thumbBlobPath);
                        thumbDeleted = true;
                        context.log('✅ Deleted thumbnail blob:', thumbBlobPath);
                    } catch (thumbError) {
                        context.log.warn('⚠️ Failed to delete thumbnail blob:', thumbError.message);
                    }
                }

                // If thumbnail wasn't deleted and we have a constructed path, try that too
                if (!thumbDeleted && constructedThumbPath && constructedThumbPath !== thumbBlobPath) {
                    try {
                        await deleteBlob(constructedThumbPath);
                        thumbDeleted = true;
                        context.log('✅ Deleted thumbnail using constructed path:', constructedThumbPath);
                    } catch (thumbError) {
                        context.log.warn('⚠️ Failed to delete thumbnail using constructed path:', thumbError.message);
                    }
                }

                // Delete from NamePhoto table (person tags)
                context.log('Deleting person tags...');
                const deleteTagsQuery = `
                    DELETE FROM dbo.NamePhoto
                    WHERE npFileName = @filename
                `;
                await execute(deleteTagsQuery, { filename: dbFileName });
                context.log('✅ Deleted person tags');

                // Delete from Pictures table
                context.log('Deleting from Pictures table...');
                const deletePictureQuery = `
                    DELETE FROM dbo.Pictures
                    WHERE PFileName = @filename
                `;
                await execute(deletePictureQuery, { filename: dbFileName });
                context.log('✅ Deleted from Pictures table');

                // Update person counts
                context.log('Updating person counts...');
                const updateCountsQuery = `
                    UPDATE dbo.NameEvent
                    SET neCount = (
                        SELECT COUNT(*)
                        FROM dbo.NamePhoto
                        WHERE npID = NameEvent.ID
                    )
                `;
                await execute(updateCountsQuery);
                context.log('✅ Updated person counts');

                context.res = {
                    status: 200,
                    body: {
                        success: true,
                        message: 'Media file deleted successfully',
                        deleted: {
                            database: true,
                            blob: blobDeleted,
                            thumbnail: thumbDeleted
                        }
                    }
                };
                return;

            } catch (deleteError) {
                context.log.error('❌ Delete error:', deleteError);
                context.log.error('Error stack:', deleteError.stack);
                context.res = {
                    status: 500,
                    body: { 
                        error: 'Failed to delete media',
                        message: deleteError.message,
                        stack: deleteError.stack,
                        details: {
                            filename: filename,
                            step: 'Check error message for details'
                        }
                    }
                };
                return;
            }
        }

        context.res = {
            status: 405,
            body: { error: 'Method not allowed' }
        };

    } catch (error) {
        context.log.error('Error:', error);
        const errorResponse = {
            error: 'Internal server error',
            message: error.message,
            stack: error.stack,
            debug: {
                url: req.url,
                method: req.method,
                params: req.params,
                query: req.query
            }
        };
        context.log.error('Error response:', JSON.stringify(errorResponse));
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(errorResponse)
        };
    }
};

// Helper function to extract a frame from video buffer
async function extractVideoFrame(videoBuffer, context) {
    return new Promise((resolve, reject) => {
        // Create temporary files for input and output
        const tempDir = os.tmpdir();
        const inputPath = path.join(tempDir, `video_${Date.now()}.tmp`);
        const outputPath = path.join(tempDir, `thumb_${Date.now()}.jpg`);
        
        context.log(`Writing video to temp file: ${inputPath}`);
        
        // Write video buffer to temp file
        fs.writeFileSync(inputPath, videoBuffer);
        
        context.log(`Extracting frame from video at 1 second mark`);
        
        // Extract frame at 1 second using ffmpeg
        ffmpeg(inputPath)
            .screenshots({
                timestamps: ['00:00:01.000'], // Extract at 1 second
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: '640x?'
            })
            .on('end', () => {
                context.log(`Frame extracted successfully: ${outputPath}`);
                try {
                    // Read the generated thumbnail
                    const thumbnailBuffer = fs.readFileSync(outputPath);
                    
                    // Clean up temp files
                    try {
                        fs.unlinkSync(inputPath);
                        fs.unlinkSync(outputPath);
                        context.log('Temp files cleaned up');
                    } catch (cleanupError) {
                        context.log.warn(`Error cleaning up temp files: ${cleanupError.message}`);
                    }
                    
                    resolve(thumbnailBuffer);
                } catch (readError) {
                    reject(new Error(`Failed to read thumbnail: ${readError.message}`));
                }
            })
            .on('error', (err) => {
                context.log.error(`FFmpeg error: ${err.message}`);
                
                // Clean up temp files
                try {
                    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                } catch (cleanupError) {
                    context.log.warn(`Error cleaning up temp files: ${cleanupError.message}`);
                }
                
                reject(new Error(`FFmpeg failed: ${err.message}`));
            });
    });
}

// Helper function to determine content type from filename
function getContentType(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const contentTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'wmv': 'video/x-ms-wmv',
        'mpg': 'video/mpeg',
        'mpeg': 'video/mpeg'
    };
    return contentTypes[ext] || 'application/octet-stream';
}
