const { checkAuthorization } = require('../shared/auth');
const { query, DatabaseWarmupError, isDatabaseWarmupError } = require('../shared/db');
const { getBlobSasUrl } = require('../shared/storage');

/**
 * DEBUG VERSION of Get Tagged Photos Endpoint
 * Enhanced with extensive logging to diagnose the 500 error
 */
module.exports = async function (context, req) {
  const debugLog = [];
  const addLog = (step, data) => {
    const entry = { step, timestamp: new Date().toISOString(), data };
    debugLog.push(entry);
    context.log(`[DEBUG ${step}]`, JSON.stringify(data));
  };

  addLog('START', { method: req.method, query: req.query });

  try {
    addLog('AUTH_CHECK_START', {});
    
    // Check authorization - requires Full role
    const { authorized, user, error } = await checkAuthorization(context, 'Full');
    
    addLog('AUTH_CHECK_COMPLETE', { authorized, userEmail: user?.Email, userRole: user?.Role, error });
    
    if (!authorized) {
      addLog('AUTH_FAILED', { error });
      context.res = {
        status: 403,
        body: { error, debugLog }
      };
      return;
    }
  } catch (authError) {
    addLog('AUTH_ERROR', { 
      message: authError.message, 
      stack: authError.stack,
      isWarmupError: authError.isWarmupError || authError instanceof DatabaseWarmupError
    });
    
    if (authError.isWarmupError || authError instanceof DatabaseWarmupError) {
      context.res = {
        status: 503,
        body: { 
          error: 'Database is warming up. Please wait a moment and try again.',
          isWarmup: true,
          debugLog 
        }
      };
      return;
    }
    
    context.res = {
      status: 500,
      body: { 
        error: 'Authorization check failed', 
        details: authError.message,
        debugLog 
      }
    };
    return;
  }

  try {
    const smartSample = req.query.smartSample !== 'false';
    const maxPerPerson = req.query.maxPerPerson ? parseInt(req.query.maxPerPerson) : null;
    
    addLog('PARAMS', { smartSample, maxPerPerson });

    // Step 1: Test basic connectivity - get count of people
    addLog('DB_TEST_START', {});
    
    const testQuery = `SELECT COUNT(*) as PeopleCount FROM dbo.NameEvent WHERE neType = 'N'`;
    const testResult = await query(testQuery);
    
    addLog('DB_TEST_COMPLETE', { peopleCount: testResult[0]?.PeopleCount });

    // Step 2: Get photo-person pairs count
    addLog('PHOTO_PAIRS_COUNT_START', {});
    
    const pairsCountQuery = `
      SELECT COUNT(*) as PairCount FROM (
        SELECT np.npFileName, np.npID
        FROM dbo.NamePhoto np
        
        UNION
        
        SELECT p.PFileName, TRY_CAST(value AS INT) as PersonID
        FROM dbo.Pictures p
        CROSS APPLY STRING_SPLIT(p.PPeopleList, ',')
        WHERE p.PPeopleList IS NOT NULL 
          AND p.PPeopleList != ''
          AND LTRIM(RTRIM(value)) != ''
          AND TRY_CAST(value AS INT) IS NOT NULL
      ) AS Pairs
    `;
    
    const pairsCount = await query(pairsCountQuery);
    addLog('PHOTO_PAIRS_COUNT_COMPLETE', { pairCount: pairsCount[0]?.PairCount });

    if (pairsCount[0]?.PairCount === 0) {
      addLog('NO_PAIRS_FOUND', {});
      context.res = {
        status: 200,
        body: {
          success: true,
          photos: [],
          message: 'No tagged photos found',
          debugLog
        }
      };
      return;
    }

    // Step 3: Get counts per person
    addLog('PERSON_COUNTS_START', {});
    
    const countQuery = `
      WITH PhotoPersonPairs AS (
        SELECT np.npFileName as PFileName, np.npID as PersonID
        FROM dbo.NamePhoto np
        
        UNION
        
        SELECT p.PFileName, TRY_CAST(value AS INT) as PersonID
        FROM dbo.Pictures p
        CROSS APPLY STRING_SPLIT(p.PPeopleList, ',')
        WHERE p.PPeopleList IS NOT NULL 
          AND p.PPeopleList != ''
          AND LTRIM(RTRIM(value)) != ''
          AND TRY_CAST(value AS INT) IS NOT NULL
      )
      SELECT 
        ne.ID as PersonID,
        ne.neName as PersonName,
        COUNT(DISTINCT pp.PFileName) as TotalPhotos
      FROM PhotoPersonPairs pp
      INNER JOIN dbo.NameEvent ne ON pp.PersonID = ne.ID
      WHERE ne.neType = 'N'
      GROUP BY ne.ID, ne.neName
      ORDER BY ne.neName
    `;
    
    const counts = await query(countQuery);
    
    addLog('PERSON_COUNTS_COMPLETE', { 
      personCount: counts.length,
      persons: counts.map(c => ({ id: c.PersonID, name: c.PersonName, photos: c.TotalPhotos }))
    });

    if (!counts || counts.length === 0) {
      addLog('NO_COUNTS_FOUND', {});
      context.res = {
        status: 200,
        body: {
          success: true,
          photos: [],
          message: 'No tagged photos found',
          debugLog
        }
      };
      return;
    }

    // Step 4: For first person only, try to get sample photos
    addLog('SAMPLE_PHOTOS_START', { firstPerson: counts[0] });
    
    const firstPerson = counts[0];
    const sampleSize = Math.min(10, firstPerson.TotalPhotos); // Just get 10 for testing
    
    const sampleQuery = `
      WITH PhotoPersonPairs AS (
        SELECT np.npFileName as PFileName, np.npID as PersonID
        FROM dbo.NamePhoto np
        
        UNION
        
        SELECT p.PFileName, TRY_CAST(value AS INT) as PersonID
        FROM dbo.Pictures p
        CROSS APPLY STRING_SPLIT(p.PPeopleList, ',')
        WHERE p.PPeopleList IS NOT NULL 
          AND p.PPeopleList != ''
          AND LTRIM(RTRIM(value)) != ''
          AND TRY_CAST(value AS INT) IS NOT NULL
      )
      SELECT TOP (@sampleSize) pp.PFileName, pp.PersonID
      FROM PhotoPersonPairs pp
      WHERE pp.PersonID = @personId
    `;
    
    const personPhotos = await query(sampleQuery, {
      personId: firstPerson.PersonID,
      sampleSize: sampleSize
    });
    
    addLog('SAMPLE_PHOTOS_COMPLETE', { 
      photosReturned: personPhotos.length,
      firstPhoto: personPhotos[0]
    });

    // Step 5: Try to generate ONE SAS URL
    addLog('SAS_URL_START', { fileName: personPhotos[0]?.PFileName });
    
    let sasUrl = null;
    let sasError = null;
    
    if (personPhotos.length > 0) {
      try {
        sasUrl = await getBlobSasUrl('family-album-media', personPhotos[0].PFileName);
        addLog('SAS_URL_COMPLETE', { url: sasUrl?.substring(0, 100) + '...' });
      } catch (err) {
        sasError = err.message;
        addLog('SAS_URL_ERROR', { 
          error: err.message, 
          stack: err.stack,
          fileName: personPhotos[0].PFileName 
        });
      }
    }

    // Return diagnostic response
    context.res = {
      status: 200,
      body: {
        success: true,
        diagnostic: true,
        message: 'Diagnostic run completed successfully',
        summary: {
          peopleInDatabase: testResult[0]?.PeopleCount,
          totalTaggedPairs: pairsCount[0]?.PairCount,
          personsWithPhotos: counts.length,
          samplePhotosReturned: personPhotos.length,
          sasUrlGenerated: !!sasUrl,
          sasError: sasError
        },
        debugLog
      }
    };

  } catch (err) {
    addLog('FATAL_ERROR', {
      message: err.message,
      stack: err.stack,
      name: err.name,
      isWarmupError: err.isWarmupError || err instanceof DatabaseWarmupError
    });
    
    context.log.error('FATAL ERROR in diagnostic endpoint:', err);
    
    // Check if this is a database warmup error
    if (err instanceof DatabaseWarmupError || isDatabaseWarmupError(err)) {
      context.res = {
        status: 503,
        body: {
          success: false,
          error: 'Database is warming up. Please wait a moment and try again.',
          isWarmup: true,
          debugLog
        }
      };
    } else {
      context.res = {
        status: 500,
        body: {
          success: false,
          error: err.message || 'Unknown error in diagnostic endpoint',
          errorName: err.name,
          stack: err.stack,
          debugLog
        }
      };
    }
  }
};
