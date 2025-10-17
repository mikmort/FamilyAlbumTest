const { query, execute } = require('../shared/db');
const { blobExists, getContainerClient, uploadBlob } = require('../shared/storage');

// Make sharp optional - only needed for thumbnail generation
let sharp = null;
try {
    sharp = require('sharp');
} catch (err) {
    console.warn('Sharp module not available - thumbnail generation disabled');
}

module.exports = async function (context, req) {
    context.log('Media API function processed a request.');

    const method = req.method;
    
    // Extract filename from URL path: /api/media/{filename}
    // req.url might be like "/api/media/On%20Location%5CFile.jpg"
    let filename = null;
    if (req.url) {
        const urlMatch = req.url.match(/^\/api\/media\/(.+?)(?:\?|$)/);
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
            
            // If path contains special chars, try with encoded filename
            const pathParts = blobPath.split('/');
            const directory = pathParts.slice(0, -1).join('/');
            const filename = pathParts[pathParts.length - 1];
            
            // Add variation with encoded filename (for blobs like "Devorah%27s%20Wedding%20003.jpg")
            const encodedFilename = directory + (directory ? '/' : '') + encodeURIComponent(filename).replace(/%2F/g, '/');
            if (encodedFilename !== blobPath) {
                pathsToTry.push(encodedFilename);
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
            if (thumbnail) {
                const thumbnailPath = `thumbnails/${filename}`;
                const thumbnailExists = await blobExists(thumbnailPath);
                
                if (!thumbnailExists) {
                    // Generate thumbnail from original file
                    context.log(`Generating thumbnail for ${filename}`);
                    
                    // Check if original exists
                    const originalExists = await blobExists(filename);
                    if (!originalExists) {
                        context.res = {
                            status: 404,
                            body: { error: 'Original media file not found' }
                        };
                        return;
                    }
                    
                    // Download original file
                    const containerClient = getContainerClient();
                    const originalBlobClient = containerClient.getBlobClient(filename);
                    const downloadResponse = await originalBlobClient.download();
                    
                    // Convert stream to buffer
                    const chunks = [];
                    for await (const chunk of downloadResponse.readableStreamBody) {
                        chunks.push(Buffer.from(chunk));
                    }
                    const originalBuffer = Buffer.concat(chunks);
                    
                    // Generate thumbnail using sharp (300px width, maintain aspect ratio)
                    let thumbnailBuffer;
                    if (sharp) {
                        try {
                            thumbnailBuffer = await sharp(originalBuffer)
                                .resize(300, null, {
                                    fit: 'inside',
                                    withoutEnlargement: true
                                })
                                .jpeg({ quality: 80 })
                                .toBuffer();
                            
                            // Upload thumbnail to blob storage
                            await uploadBlob(thumbnailPath, thumbnailBuffer, 'image/jpeg');
                            context.log(`Thumbnail generated and saved: ${thumbnailPath}`);
                        } catch (sharpError) {
                            context.log.error(`Error generating thumbnail: ${sharpError.message}`);
                            // If thumbnail generation fails (e.g., for videos), use original
                            blobPath = filename;
                        }
                    } else {
                        // Sharp not available, use original image
                        context.log('Sharp not available, using original image');
                        blobPath = filename;
                    }
                }
                
                // Use thumbnail path if it exists or was just created
                if (await blobExists(thumbnailPath)) {
                    blobPath = thumbnailPath;
                }
            }
            
            // Check if file exists in blob storage
            const exists = await blobExists(blobPath);
            
            if (!exists) {
                context.res = {
                    status: 404,
                    body: { error: 'Media file not found in storage' }
                };
                return;
            }

            // Get blob client
            const containerClient = getContainerClient();
            const blobClient = containerClient.getBlobClient(blobPath);
            
            // Download the blob
            const downloadResponse = await blobClient.download();
            
            // Determine content type
            const contentType = downloadResponse.contentType || getContentType(blobPath);
            
            // Stream the blob content
            context.res = {
                status: 200,
                headers: {
                    'Content-Type': contentType,
                    'Content-Disposition': `inline; filename="${blobPath.split('/').pop()}"`,
                    'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
                },
                body: downloadResponse.readableStreamBody,
                isRaw: true
            };
            return;
        }

        // GET /api/media - List all media with optional filters
        if (method === 'GET' && !filename) {
            const peopleIds = req.query.peopleIds ? req.query.peopleIds.split(',').map(id => parseInt(id)) : [];
            const eventId = req.query.eventId ? parseInt(req.query.eventId) : null;
            const noPeople = req.query.noPeople === 'true';
            const sortOrder = req.query.sortOrder || 'desc';
            const exclusiveFilter = req.query.exclusiveFilter === 'true';

            let mediaQuery = `
                SELECT DISTINCT p.*
                FROM dbo.Pictures p
            `;
            
            const whereClauses = [];
            const params = {};

            // Filter by people
            if (peopleIds.length > 0) {
                if (exclusiveFilter) {
                    // Exclusive: photo must have ONLY the selected people (and no others)
                    // This is complex - for now, implement inclusive filter
                    const personPlaceholders = peopleIds.map((_, i) => `@person${i}`).join(',');
                    whereClauses.push(`
                        EXISTS (
                            SELECT 1 FROM dbo.NamePhoto np 
                            WHERE np.npFileName = p.PFileName 
                            AND np.npID IN (${personPlaceholders})
                        )
                    `);
                    peopleIds.forEach((id, i) => {
                        params[`person${i}`] = id;
                    });
                } else {
                    // Inclusive: photo must have at least one of the selected people
                    const personPlaceholders = peopleIds.map((_, i) => `@person${i}`).join(',');
                    whereClauses.push(`
                        EXISTS (
                            SELECT 1 FROM dbo.NamePhoto np 
                            WHERE np.npFileName = p.PFileName 
                            AND np.npID IN (${personPlaceholders})
                        )
                    `);
                    peopleIds.forEach((id, i) => {
                        params[`person${i}`] = id;
                    });
                }
            }

            // Filter by event
            if (eventId) {
                whereClauses.push(`
                    EXISTS (
                        SELECT 1 FROM dbo.NamePhoto np 
                        WHERE np.npFileName = p.PFileName 
                        AND np.npID = @eventId
                    )
                `);
                params.eventId = eventId;
            }

            // Filter for photos with no people
            if (noPeople) {
                whereClauses.push(`
                    NOT EXISTS (
                        SELECT 1 FROM dbo.NamePhoto np 
                        WHERE np.npFileName = p.PFileName
                    )
                `);
            }

            if (whereClauses.length > 0) {
                mediaQuery += ` WHERE ${whereClauses.join(' AND ')}`;
            }

            // Sorting
            const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
            mediaQuery += ` ORDER BY p.PYear ${orderDirection}, p.PMonth ${orderDirection}, p.PFileName ${orderDirection}`;

            const media = await query(mediaQuery, params);

            // Transform results to construct proper blob URLs
            // Combine PFileDirectory and PFileName to get the full blob path
            const transformedMedia = media.map(item => {
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
                return {
                    ...item,
                    PBlobUrl: `/api/media/${blobPath}`,
                    PThumbnailUrl: `/api/media/${blobPath}`
                };
            });

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: transformedMedia
            };
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

            const insertQuery = `
                INSERT INTO dbo.NamePhoto (npFileName, npID, npPosition)
                VALUES (@filename, @personId, @position)
            `;

            await execute(insertQuery, {
                filename,
                personId,
                position: position || 0
            });

            context.res = {
                status: 201,
                body: { success: true }
            };
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

            const deleteQuery = `
                DELETE FROM dbo.NamePhoto
                WHERE npFileName = @filename AND npID = @personId
            `;

            await execute(deleteQuery, { filename, personId });

            context.res = {
                status: 204
            };
            return;
        }

        context.res = {
            status: 405,
            body: { error: 'Method not allowed' }
        };

    } catch (error) {
        context.log.error('Error:', error);
        context.res = {
            status: 500,
            body: { error: 'Internal server error', message: error.message }
        };
    }
};

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
