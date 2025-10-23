const { query, execute } = require('../shared/db');
const { blobExists, getContainerClient, uploadBlob } = require('../shared/storage');
const fs = require('fs');
const os = require('os');
const path = require('path');

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

module.exports = async function (context, req) {
    // Log everything for debugging
    context.log('=== MEDIA API DEBUG ===');
    context.log('req.url:', req.url);
    context.log('req.method:', req.method);
    context.log('req.params:', JSON.stringify(req.params));
    context.log('req.query:', JSON.stringify(req.query));
    context.log('======================');
    
    context.log('Media API function processed a request.');

    const method = req.method;
    
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
    // Support additional trailing segments like /tags or /tags/{id}
    let filename = null;
    if (req.url) {
        // Extract path without query string first
        const pathOnly = req.url.split('?')[0];
        
        // Match: /api/media/ then capture everything up to /tags, or end of string
        // This allows paths with forward slashes like: /api/media/Events/Birthday/photo.jpg
        const urlMatch = pathOnly.match(/^\/api\/media\/(.+?)(?:\/tags(?:\/|$)|$)/);
        if (urlMatch && urlMatch[1]) {
            filename = decodeURIComponent(urlMatch[1]);
        }
    }
    
    // Fallback to route params if URL parsing didn't work
    if (!filename && req.params && req.params.filename) {
        filename = decodeURIComponent(req.params.filename);
        if (filename === '' || filename === '/') {
            filename = null;
        }
    }

    // Normalize path: convert backslashes to forward slashes for blob storage
    if (filename) {
        filename = filename.replace(/\\/g, '/');
    }

    // Check if thumbnail is requested
    const thumbnail = req.query.thumbnail === 'true';

    context.log(`Method: ${method}, URL: ${req.url}, Filename: ${filename}, Thumbnail: ${thumbnail}`);

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
            ];
            
            // If path contains special chars, try with encoded variations
            const pathParts = blobPath.split('/');
            const directory = pathParts.slice(0, -1).join('/');
            const filenamePart = pathParts[pathParts.length - 1];
            
            // Add variation with spaces encoded only
            if (filenamePart.includes(' ') && !filenamePart.includes('%20')) {
                const spacesEncoded = directory + (directory ? '/' : '') + filenamePart.replace(/ /g, '%20');
                pathsToTry.push(spacesEncoded);
            }
            
            // Add variation with full encoding (apostrophes AND spaces)
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
                // Use full path (including directory) to avoid conflicts with duplicate filenames
                const thumbnailPath = `thumbnails/${foundPath}`;
                const thumbnailExists = await blobExists(thumbnailPath);
                
                let shouldRegenerate = false;
                
                // If thumbnail exists, check if it's a placeholder (too small)
                if (thumbnailExists) {
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
                            
                            // Fall back to placeholder
                            context.log.warn(`Falling back to placeholder thumbnail for video`);
                            const placeholderBuffer = Buffer.from(
                                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                                'base64'
                            );
                            await uploadBlob(thumbnailPath, placeholderBuffer, 'image/png');
                            context.log(`⚠️ Using placeholder for video thumbnail: ${thumbnailPath}`);
                            blobPath = thumbnailPath;
                        }
                    } else if (isVideo && !ffmpeg) {
                        // FFmpeg not available, use placeholder
                        context.log(`Video file detected but ffmpeg not available, using placeholder`);
                        const placeholderBuffer = Buffer.from(
                            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                            'base64'
                        );
                        await uploadBlob(thumbnailPath, placeholderBuffer, 'image/png');
                        context.log(`Placeholder thumbnail saved for video: ${thumbnailPath}`);
                        blobPath = thumbnailPath;
                    } else {
                        // Generate thumbnail using sharp for images (300px width, maintain aspect ratio)
                        if (sharp) {
                            try {
                                const thumbnailBuffer = await sharp(originalBuffer)
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
                
                // Return the buffer
                context.res = {
                    status: 200,
                    headers: {
                        'Content-Type': contentType,
                        'Content-Disposition': `inline; filename="${blobPath.split('/').pop()}"`,
                        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
                        'Content-Length': buffer.length.toString()
                    },
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
            if (noPeople) {
                whereClauses.push(`
                    NOT EXISTS (
                        SELECT 1 FROM dbo.NamePhoto np 
                        INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                        WHERE np.npFileName = p.PFileName
                        AND ne.neType = 'N'
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
                    const eventQuery = `SELECT ID, neName, neType FROM dbo.NameEvent WHERE ID IN (${idPlaceholders})`;
                    const eventParams = {};
                    ids.forEach((id, i) => { eventParams[`id${i}`] = id; });
                    
                    try {
                        context.log(`Fetching NameEvent records for ${ids.length} IDs from PPeopleList and NamePhoto...`);
                        const eventRows = await query(eventQuery, eventParams);
                        context.log(`Found ${eventRows.length} NameEvent records`);
                        eventRows.forEach(r => {
                            eventLookup[r.ID] = { ID: r.ID, neName: r.neName, neType: r.neType };
                        });
                    } catch (evErr) {
                        context.log.error('Error querying NameEvent IDs:', evErr);
                        throw evErr;
                    }
                }

                // Build NamePhoto event lookup for individual media items
                // Note: For media lists, this is too expensive and is disabled
                // Events from NamePhoto will only be included when viewing single items
                let npEventLookup = {};
            }

            // Transform results to construct proper blob URLs
            // Combine PFileDirectory and PFileName to get the full blob path
            context.log('Transforming media results with blob URLs...');
            
            let transformedMedia;
            try {
                transformedMedia = media.map(item => {
                    const directory = item.PFileDirectory || '';
                    const fileName = item.PFileName || '';
                    
                    // Construct the blob path: directory/filename
                    // But check if fileName already contains the directory to avoid duplication
                    let blobPath;
                    if (directory && fileName.startsWith(directory)) {
                        // Filename already contains the full path
                        blobPath = fileName;
                    } else if (directory) {
                        // Need to combine directory and filename
                        blobPath = `${directory}/${fileName}`;
                    } else {
                        // No directory, just use filename
                        blobPath = fileName;
                    }
                    
                    // Normalize slashes (convert backslash to forward slash)
                    blobPath = blobPath.replace(/\\/g, '/');
                    
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
                                        neName: lookup.neName
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

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: transformedMedia
            };
            context.log('Media list response sent successfully');
            return;
        }

        // POST /api/media/{filename}/tags - Tag a person in a photo
        if (method === 'POST' && filename) {
            const { personId, position } = req.body;

            if (!personId) {
                context.res = {
                    status: 400,
                    body: { error: 'Person ID is required' }
                };
                return;
            }

            try {
                // Get current picture to access PPeopleList
                const pictureQuery = `
                    SELECT PFileName, PPeopleList, PNameCount
                    FROM dbo.Pictures
                    WHERE PFileName = @filename
                `;
                const pictures = await execute(pictureQuery, { filename });
                
                if (pictures.length === 0) {
                    context.res = {
                        status: 404,
                        body: { error: 'Picture not found' }
                    };
                    return;
                }

                const picture = pictures[0];
                
                // Parse current PPeopleList
                const currentPeopleIds = picture.PPeopleList 
                    ? picture.PPeopleList.split(',').map(s => s.trim()).filter(Boolean).map(s => parseInt(s, 10))
                    : [];
                
                const insertPos = position || 0;
                const clampedPos = Math.max(0, Math.min(insertPos, currentPeopleIds.length));
                
                // Insert the new person at the specified position
                currentPeopleIds.splice(clampedPos, 0, personId);

                // Insert the NamePhoto record
                const insertQuery = `
                    INSERT INTO dbo.NamePhoto (npFileName, npID)
                    VALUES (@filename, @personId)
                `;
                await execute(insertQuery, {
                    filename,
                    personId
                });

                // Update PPeopleList and PNameCount in Pictures table
                const newPeopleList = currentPeopleIds.join(',');
                const updatePictureQuery = `
                    UPDATE dbo.Pictures
                    SET PPeopleList = @peopleList,
                        PNameCount = @nameCount,
                        PLastModifiedDate = GETDATE()
                    WHERE PFileName = @filename
                `;
                await execute(updatePictureQuery, {
                    filename,
                    peopleList: newPeopleList,
                    nameCount: currentPeopleIds.length
                });

                context.res = {
                    status: 201,
                    body: { success: true, peopleList: newPeopleList, nameCount: currentPeopleIds.length }
                };
            } catch (error) {
                context.log('❌ Error tagging person:', error);
                context.res = {
                    status: 500,
                    body: { error: error.message || 'Failed to tag person' }
                };
            }
            return;
        }

        // DELETE /api/media/{filename}/tags/{personId} - Remove person tag
        if (method === 'DELETE' && filename) {
            const { personId } = req.body;

            if (!personId) {
                context.res = {
                    status: 400,
                    body: { error: 'Person ID is required' }
                };
                return;
            }

            try {
                // Get current picture to access PPeopleList
                const pictureQuery = `
                    SELECT PFileName, PPeopleList, PNameCount
                    FROM dbo.Pictures
                    WHERE PFileName = @filename
                `;
                const pictures = await execute(pictureQuery, { filename });
                
                if (pictures.length === 0) {
                    context.res = {
                        status: 404,
                        body: { error: 'Picture not found' }
                    };
                    return;
                }

                const picture = pictures[0];
                
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
                await execute(deleteQuery, { filename, personId });

                // Remove person from the list
                currentPeopleIds.splice(personIndex, 1);
                
                // Update PPeopleList and PNameCount in Pictures table
                const newPeopleList = currentPeopleIds.join(',');
                const updatePictureQuery = `
                    UPDATE dbo.Pictures
                    SET PPeopleList = @peopleList,
                        PNameCount = @nameCount,
                        PLastModifiedDate = GETDATE()
                    WHERE PFileName = @filename
                `;
                await execute(updatePictureQuery, {
                    filename,
                    peopleList: newPeopleList,
                    nameCount: currentPeopleIds.length
                });

                context.res = {
                    status: 200,
                    body: { success: true, peopleList: newPeopleList, nameCount: currentPeopleIds.length }
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

            // Build update query dynamically based on provided fields
            const updates = [];
            const params = { filename };

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

            if (eventID !== undefined) {
                // Note: eventID is stored in PPeopleList column (legacy design)
                // For now, we'll skip event updates - would need schema change
                context.log('Event update not yet implemented');
            }

            if (updates.length === 0) {
                context.res = {
                    status: 400,
                    body: { error: 'No fields to update' }
                };
                return;
            }

            updates.push('PLastModifiedDate = GETDATE()');

            const updateQuery = `
                UPDATE dbo.Pictures
                SET ${updates.join(', ')}
                WHERE PFileName = @filename
            `;

            context.log('Executing update query:', updateQuery);
            context.log('With params:', params);

            await execute(updateQuery, params);

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

            const result = await query(selectQuery, { filename });
            
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
