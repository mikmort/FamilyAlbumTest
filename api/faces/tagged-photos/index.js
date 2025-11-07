const { checkAuthorization } = require('../../shared/auth');
const { query } = require('../../shared/db');
const { getBlobSasUrl } = require('../../shared/storage');

/**
 * Get Tagged Photos Endpoint
 * 
 * Returns all photos that have manual person tags (from NamePhoto table).
 * Used by face training to get photos with known people for creating embeddings.
 * 
 * GET /api/faces/tagged-photos?maxPerPerson=5
 * 
 * Query params:
 *   maxPerPerson (optional): Limit photos per person (for baseline training)
 * 
 * Returns: {
 *   "success": true,
 *   "photos": [
 *     {
 *       "PFileName": "photo.jpg",
 *       "PersonID": 123,
 *       "PersonName": "John Doe",
 *       "url": "https://...blob.core.windows.net/..."
 *     }
 *   ]
 * }
 */
module.exports = async function (context, req) {
  context.log('Get tagged photos processing request');

  try {
    // Check authorization - requires Full role
    const { authorized, user, error } = await checkAuthorization(context, 'Full');
    if (!authorized) {
      context.res = {
        status: 403,
        body: { error }
      };
      return;
    }
  } catch (authError) {
    context.log.error('Authorization error:', authError);
    context.res = {
      status: 500,
      body: { error: 'Authorization check failed', details: authError.message }
    };
    return;
  }

  try {
    const maxPerPerson = req.query.maxPerPerson ? parseInt(req.query.maxPerPerson) : null;

    // Query for photos with people tags, with optional limit per person
    let sqlQuery;
    let params = {};

    if (maxPerPerson) {
      // Use ROW_NUMBER to limit photos per person
      sqlQuery = `
        WITH RankedPhotos AS (
          SELECT 
            np.npFileName as PFileName,
            ne.ID as PersonID,
            ne.neName as PersonName,
            ROW_NUMBER() OVER (PARTITION BY ne.ID ORDER BY np.npFileName) as RowNum
          FROM dbo.NamePhoto np
          INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
          WHERE ne.neType = 'N' -- Only people, not events
        )
        SELECT PFileName, PersonID, PersonName
        FROM RankedPhotos
        WHERE RowNum <= @maxPerPerson
        ORDER BY PersonName, PFileName
      `;
      params.maxPerPerson = maxPerPerson;
    } else {
      // Get all tagged photos
      sqlQuery = `
        SELECT 
          np.npFileName as PFileName,
          ne.ID as PersonID,
          ne.neName as PersonName
        FROM dbo.NamePhoto np
        INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
        WHERE ne.neType = 'N' -- Only people, not events
        ORDER BY ne.neName, np.npFileName
      `;
    }

    const results = await query(sqlQuery, params);

    if (!results || results.length === 0) {
      context.res = {
        status: 200,
        body: {
          success: true,
          photos: [],
          message: 'No tagged photos found'
        }
      };
      return;
    }

    // Generate SAS URLs for each photo
    const photos = await Promise.all(results.map(async (photo) => {
      try {
        const sasUrl = await getBlobSasUrl('family-album-media', photo.PFileName);
        return {
          PFileName: photo.PFileName,
          PersonID: photo.PersonID,
          PersonName: photo.PersonName,
          url: sasUrl
        };
      } catch (err) {
        context.log.error(`Error generating SAS URL for ${photo.PFileName}:`, err);
        return null;
      }
    }));

    // Filter out any null results (failed SAS URL generation)
    const validPhotos = photos.filter(p => p !== null);

    context.log(`Returning ${validPhotos.length} tagged photos${maxPerPerson ? ` (max ${maxPerPerson} per person)` : ''}`);

    context.res = {
      status: 200,
      body: {
        success: true,
        photos: validPhotos,
        totalCount: validPhotos.length,
        maxPerPerson: maxPerPerson || null
      }
    };

  } catch (err) {
    context.log.error('Error fetching tagged photos:', err);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: err.message || 'Error fetching tagged photos'
      }
    };
  }
};
