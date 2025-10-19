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
                // Get just the filename part from the found path for thumbnail naming
                const foundFilenamePart = foundPath.split('/').pop();
                const thumbnailPath = `thumbnails/${foundFilenamePart}`;
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

            // Fetch tagged people for all photos in one query
            let taggedPeopleMap = {};
            if (media.length > 0) {
                context.log('Fetching tagged people for media items...');
                const peopleQuery = `
                    SELECT np.npFileName, ne.ID, ne.neName
                    FROM dbo.NamePhoto np
                    INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                    WHERE np.npFileName IN (${media.map((_, i) => `@filename${i}`).join(',')})
                    ORDER BY np.npFileName, np.npPosition
                `;
                
                const peopleParams = {};
                media.forEach((item, i) => {
                    peopleParams[`filename${i}`] = item.PFileName;
                });
                
                context.log('Executing tagged people query...');
                context.log(`Query will fetch people for ${media.length} media items`);
                
                let taggedPeopleResults;
                try {
                    taggedPeopleResults = await query(peopleQuery, peopleParams);
                    context.log(`Found ${taggedPeopleResults.length} people tags`);
                } catch (peopleQueryError) {
                    context.log.error('Error fetching tagged people:', peopleQueryError);
                    throw peopleQueryError;
                }
                
                // Group by filename
                taggedPeopleResults.forEach(row => {
                    if (!taggedPeopleMap[row.npFileName]) {
                        taggedPeopleMap[row.npFileName] = [];
                    }
                    taggedPeopleMap[row.npFileName].push({
                        ID: row.ID,
                        neName: row.neName
                    });
                });
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
                    
                    return {
                        ...item,
                        PBlobUrl: `/api/media/${blobPath}`,
                        PThumbnailUrl: `/api/media/${blobPath}?thumbnail=true`,
                        TaggedPeople: taggedPeopleMap[item.PFileName] || []
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
