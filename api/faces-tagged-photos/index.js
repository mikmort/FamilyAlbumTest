const { checkAuthorization } = require('../shared/auth');
const { query } = require('../shared/db');
const { getBlobSasUrl } = require('../shared/storage');

/**
 * Calculate smart sample size based on total photos for a person
 * Uses logarithmic scaling to balance coverage and efficiency:
 * - 1-10 photos: all photos (100%)
 * - 20 photos: 10 (50%)
 * - 50 photos: 15 (30%)
 * - 100 photos: 20 (20%)
 * - 500 photos: 35 (7%)
 * - 1000 photos: 45 (4.5%)
 * - 5000+ photos: 60 (1-2%)
 */
function calculateSampleSize(totalPhotos) {
  if (totalPhotos <= 10) return totalPhotos;
  if (totalPhotos <= 20) return 10;
  
  // Logarithmic scaling: min(5 + 15 * log10(total/10), 60)
  const scaledSize = Math.floor(5 + 15 * Math.log10(totalPhotos / 10));
  return Math.min(scaledSize, 60); // Cap at 60 photos per person
}

/**
 * Get Tagged Photos Endpoint
 * 
 * Returns photos with manual person tags, using intelligent sampling:
 * - Distributes samples across photo timeline (using dates)
 * - Uses logarithmic scaling based on total photos per person
 * - Minimum 5 photos, scales up to 60 for people with thousands of photos
 * 
 * Sources:
 * - NamePhoto table: preferred source of truth for who appears in photos
 * - PPeopleList field: fallback for photos not yet in NamePhoto table
 * 
 * GET /api/faces/tagged-photos?smartSample=true
 * 
 * Query params:
 *   smartSample (optional): Use intelligent sampling (default: true)
 *   maxPerPerson (optional): Override with fixed limit per person
 * 
 * Returns: {
 *   "success": true,
 *   "photos": [...],
 *   "samplingStats": { personId: { total: X, sampled: Y }, ... }
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
    const smartSample = req.query.smartSample !== 'false'; // Default true
    const maxPerPerson = req.query.maxPerPerson ? parseInt(req.query.maxPerPerson) : null;

    // Common CTE that combines tags from both NamePhoto table and PPeopleList field
    const photoPersonPairsCTE = `
      WITH PhotoPersonPairs AS (
        -- Get tags from NamePhoto table (preferred source of truth)
        SELECT 
          np.npFileName as PFileName,
          np.npID as PersonID
        FROM dbo.NamePhoto np
        
        UNION
        
        -- Also get tags from PPeopleList field (fallback for photos not in NamePhoto)
        SELECT 
          p.PFileName,
          TRY_CAST(value AS INT) as PersonID
        FROM dbo.Pictures p
        CROSS APPLY STRING_SPLIT(p.PPeopleList, ',')
        WHERE p.PPeopleList IS NOT NULL 
          AND p.PPeopleList != ''
          AND LTRIM(RTRIM(value)) != ''
          AND TRY_CAST(value AS INT) IS NOT NULL
      )`;

    let sqlQuery;
    let params = {};

    if (smartSample && !maxPerPerson) {
      // Step 1: Get counts per person to calculate sample sizes
      const countQuery = `
        ${photoPersonPairsCTE}
        SELECT 
          ne.ID as PersonID,
          ne.neName as PersonName,
          COUNT(DISTINCT pp.PFileName) as TotalPhotos
        FROM PhotoPersonPairs pp
        INNER JOIN dbo.NameEvent ne ON pp.PersonID = ne.ID
        WHERE ne.neType = 'N' -- Only people, not events
        GROUP BY ne.ID, ne.neName
        ORDER BY ne.neName
      `;
      
      const counts = await query(countQuery);
      
      if (!counts || counts.length === 0) {
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

      // Step 2: For each person, calculate sample size and get distributed samples
      const allPhotos = [];
      const samplingStats = {};

      for (const personCount of counts) {
        const sampleSize = calculateSampleSize(personCount.TotalPhotos);
        samplingStats[personCount.PersonID] = {
          name: personCount.PersonName,
          total: personCount.TotalPhotos,
          sampled: sampleSize
        };

        // Get photos distributed across timeline
        // Use a simpler approach: calculate bucket size and take one photo per bucket
        const sampleQuery = `
          ${photoPersonPairsCTE},
          PhotosWithDates AS (
            SELECT 
              pp.PFileName,
              pp.PersonID,
              COALESCE(
                p.PDateEntered,
                DATEFROMPARTS(ISNULL(p.PYear, 2000), ISNULL(p.PMonth, 1), 1),
                p.PLastModifiedDate,
                '1900-01-01'
              ) as PhotoDate,
              ROW_NUMBER() OVER (ORDER BY COALESCE(
                p.PDateEntered,
                DATEFROMPARTS(ISNULL(p.PYear, 2000), ISNULL(p.PMonth, 1), 1),
                p.PLastModifiedDate,
                '1900-01-01'
              )) as RowNum
            FROM PhotoPersonPairs pp
            INNER JOIN dbo.Pictures p ON pp.PFileName = p.PFileName
            WHERE pp.PersonID = @personId
          ),
          TotalCount AS (
            SELECT COUNT(*) as Total FROM PhotosWithDates
          )
          SELECT TOP (@sampleSize) PFileName, PersonID
          FROM PhotosWithDates, TotalCount
          WHERE (RowNum - 1) % (CASE WHEN Total < @sampleSize THEN 1 ELSE Total / @sampleSize END) = 0
          ORDER BY PhotoDate
        `;

        const personPhotos = await query(sampleQuery, {
          personId: personCount.PersonID,
          sampleSize: sampleSize
        });

        // Add person name to each photo
        personPhotos.forEach(photo => {
          photo.PersonName = personCount.PersonName;
          allPhotos.push(photo);
        });
      }

      context.log(`Smart sampling: ${allPhotos.length} photos from ${counts.length} people`);
      
      // Generate SAS URLs
      const photosWithUrls = await Promise.all(allPhotos.map(async (photo) => {
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

      const validPhotos = photosWithUrls.filter(p => p !== null);

      context.res = {
        status: 200,
        body: {
          success: true,
          photos: validPhotos,
          totalCount: validPhotos.length,
          samplingStats: samplingStats,
          smartSample: true
        }
      };
      return;

    } else if (maxPerPerson) {
      // Fixed limit per person (legacy mode)
      sqlQuery = `
        ${photoPersonPairsCTE},
        RankedPhotos AS (
          SELECT 
            pp.PFileName as PFileName,
            ne.ID as PersonID,
            ne.neName as PersonName,
            ROW_NUMBER() OVER (PARTITION BY ne.ID ORDER BY pp.PFileName) as RowNum
          FROM PhotoPersonPairs pp
          INNER JOIN dbo.NameEvent ne ON pp.PersonID = ne.ID
          WHERE ne.neType = 'N' -- Only people, not events
        )
        SELECT PFileName, PersonID, PersonName
        FROM RankedPhotos
        WHERE RowNum <= @maxPerPerson
        ORDER BY PersonName, PFileName
      `;
      params.maxPerPerson = maxPerPerson;
    } else {
      // Get all tagged photos (no sampling)
      sqlQuery = `
        ${photoPersonPairsCTE}
        SELECT 
          pp.PFileName as PFileName,
          ne.ID as PersonID,
          ne.neName as PersonName
        FROM PhotoPersonPairs pp
        INNER JOIN dbo.NameEvent ne ON pp.PersonID = ne.ID
        WHERE ne.neType = 'N' -- Only people, not events
        ORDER BY ne.neName, pp.PFileName
      `;
    }

    // Execute query for fixed limit or all photos modes
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
        maxPerPerson: maxPerPerson || null,
        smartSample: false
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