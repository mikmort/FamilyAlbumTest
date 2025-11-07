const { checkAuthorization } = require('../shared/auth');
const { query } = require('../shared/db');

/**
 * Check Face Embeddings Data Quality
 * 
 * GET /api/check-embeddings
 * 
 * Returns summary statistics and data quality information about stored embeddings
 */
module.exports = async function (context, req) {
  context.log('Checking face embeddings data quality');

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

    // Get summary statistics
    const summary = await query(`
      SELECT 
        COUNT(*) as TotalEmbeddings,
        COUNT(DISTINCT PersonID) as UniquePeople,
        COUNT(DISTINCT PhotoFileName) as UniquePhotos
      FROM FaceEmbeddings
    `);
    
    // Get breakdown by person
    const byPerson = await query(`
      SELECT 
        ne.neName as PersonName,
        COUNT(*) as EmbeddingCount,
        COUNT(DISTINCT fe.PhotoFileName) as PhotoCount
      FROM FaceEmbeddings fe
      INNER JOIN NameEvent ne ON fe.PersonID = ne.ID
      GROUP BY ne.neName
      ORDER BY COUNT(*) DESC
    `);
    
    // Get a sample embedding to check data quality
    const sample = await query(`
      SELECT TOP 1 
        PersonID,
        PhotoFileName,
        Embedding,
        CreatedDate
      FROM FaceEmbeddings
      ORDER BY CreatedDate DESC
    `);
    
    let embeddingQuality = null;
    if (sample.length > 0) {
      try {
        const embeddingArray = JSON.parse(sample[0].Embedding);
        embeddingQuality = {
          personId: sample[0].PersonID,
          photoFileName: sample[0].PhotoFileName,
          dimension: embeddingArray.length,
          expectedDimension: 128,
          isValid: embeddingArray.length === 128,
          valueRange: {
            min: Math.min(...embeddingArray),
            max: Math.max(...embeddingArray)
          },
          sampleValues: embeddingArray.slice(0, 5),
          createdDate: sample[0].CreatedDate
        };
      } catch (parseErr) {
        embeddingQuality = {
          error: 'Failed to parse embedding JSON',
          details: parseErr.message
        };
      }
    }

    context.res = {
      status: 200,
      body: {
        success: true,
        summary: summary[0],
        byPerson,
        embeddingQuality
      }
    };

  } catch (err) {
    context.log.error('Error checking embeddings:', err);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: err.message || 'Error checking embeddings data'
      }
    };
  }
};
