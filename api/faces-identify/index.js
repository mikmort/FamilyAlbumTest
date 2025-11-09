const { checkAuthorization } = require('../shared/auth');
const { query } = require('../shared/db');

/**
 * Identify Face Endpoint
 * 
 * Finds the best matching person for a given face embedding using cosine similarity.
 * Returns the top N matches with similarity scores.
 * 
 * POST /api/faces/identify
 * 
 * Body: {
 *   "embedding": [0.123, -0.456, ...], // 128 floats
 *   "threshold": 0.6, // Optional, minimum similarity (0-1)
 *   "topN": 5 // Optional, number of results to return
 * }
 * 
 * Returns: {
 *   "success": true,
 *   "matches": [
 *     {
 *       "personId": 123,
 *       "personName": "John Doe",
 *       "similarity": 0.92,
 *       "photoFileName": "photo.jpg"
 *     }
 *   ]
 * }
 */

/**
 * Calculate cosine similarity between two embedding vectors
 * @param {number[]} embedding1 - First 128-dim embedding
 * @param {number[]} embedding2 - Second 128-dim embedding
 * @returns {number} Similarity score between 0 and 1
 */
function cosineSimilarity(embedding1, embedding2) {
  if (embedding1.length !== 128 || embedding2.length !== 128) {
    throw new Error('Embeddings must be 128-dimensional');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < 128; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculate Euclidean distance between two embedding vectors
 * face-api.js uses this by default for matching
 * Returns distance (lower is better), converted to similarity (higher is better)
 * 
 * face-api.js threshold: 0.6 (distances <= 0.6 are considered matches)
 * 
 * @param {number[]} embedding1 - First 128-dim embedding
 * @param {number[]} embedding2 - Second 128-dim embedding
 * @returns {number} Similarity score between 0 and 1
 */
function euclideanSimilarity(embedding1, embedding2) {
  if (embedding1.length !== 128 || embedding2.length !== 128) {
    throw new Error('Embeddings must be 128-dimensional');
  }

  let sumSquares = 0;
  for (let i = 0; i < 128; i++) {
    const diff = embedding1[i] - embedding2[i];
    sumSquares += diff * diff;
  }
  
  const distance = Math.sqrt(sumSquares);
  
  // face-api.js uses Euclidean distance with threshold 0.6
  // Convert to similarity percentage using exponential decay:
  // Distance 0.0 = 100% match
  // Distance 0.4 = ~85% match (excellent)
  // Distance 0.6 = ~70% match (threshold - good)
  // Distance 0.8 = ~50% match (poor)
  // Distance 1.0 = ~37% match (very poor)
  // Distance 1.5+ = ~10% match (no match)
  
  // Using formula: similarity = e^(-k*distance) where k controls decay rate
  // With k=1.5, we get good discrimination around the 0.6 threshold
  const similarity = Math.exp(-1.5 * distance);
  
  return similarity;
}

module.exports = async function (context, req) {
  context.log('Identify face processing request');

  try {
    // Check authorization - requires Read role
    const { authorized, user, error } = await checkAuthorization(context, 'Read');
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
    const { embedding, threshold = 0.7, topN = 5 } = req.body;

    // Validate input
    if (!embedding || !Array.isArray(embedding) || embedding.length !== 128) {
      context.res = {
        status: 400,
        body: { error: 'Embedding must be an array of 128 floats' }
      };
      return;
    }

    // Get all stored embeddings with person names
    const storedEmbeddings = await query(
      `SELECT 
        fe.ID,
        fe.PersonID,
        fe.PhotoFileName,
        fe.Embedding,
        ne.neName as PersonName
       FROM dbo.FaceEmbeddings fe
       INNER JOIN dbo.NameEvent ne ON fe.PersonID = ne.ID
       WHERE ne.neType = 'N'`
    );

    if (!storedEmbeddings || storedEmbeddings.length === 0) {
      context.res = {
        status: 200,
        body: {
          success: true,
          matches: [],
          message: 'No trained faces found. Please train the model first.'
        }
      };
      return;
    }

    // Calculate similarity for each stored embedding
    const allScores = []; // Track all scores for debugging
    const scoresByPerson = {}; // Group scores by person
    
    for (const stored of storedEmbeddings) {
      try {
        const storedEmbedding = JSON.parse(stored.Embedding);
        
        // Use Euclidean distance (face-api.js default) instead of cosine similarity
        const similarity = euclideanSimilarity(embedding, storedEmbedding);

        // Track for debugging
        allScores.push({
          personName: stored.PersonName,
          similarity: similarity,
          photoFileName: stored.PhotoFileName
        });

        // Group by person ID
        if (!scoresByPerson[stored.PersonID]) {
          scoresByPerson[stored.PersonID] = {
            personId: stored.PersonID,
            personName: stored.PersonName,
            scores: [],
            maxSimilarity: 0,
            avgSimilarity: 0
          };
        }
        
        scoresByPerson[stored.PersonID].scores.push({
          similarity: similarity,
          embeddingId: stored.ID,
          photoFileName: stored.PhotoFileName
        });
        
        // Track max similarity for this person
        if (similarity > scoresByPerson[stored.PersonID].maxSimilarity) {
          scoresByPerson[stored.PersonID].maxSimilarity = similarity;
          scoresByPerson[stored.PersonID].bestPhotoFileName = stored.PhotoFileName;
          scoresByPerson[stored.PersonID].bestEmbeddingId = stored.ID;
        }
      } catch (parseError) {
        context.log.error(`Error parsing embedding ${stored.ID}:`, parseError);
      }
    }

    // Calculate average similarity for each person
    for (const personId in scoresByPerson) {
      const person = scoresByPerson[personId];
      const sum = person.scores.reduce((acc, s) => acc + s.similarity, 0);
      person.avgSimilarity = sum / person.scores.length;
      person.embeddingCount = person.scores.length;
    }

    // Log top 10 individual scores for debugging
    allScores.sort((a, b) => b.similarity - a.similarity);
    context.log('Top 10 individual embedding scores:', allScores.slice(0, 10).map(s => 
      `${s.personName}: ${(s.similarity * 100).toFixed(1)}%`
    ));

    // Convert to array and sort by average similarity (gives equal weight to all people)
    const personMatches = Object.values(scoresByPerson)
      .map(person => ({
        embeddingId: person.bestEmbeddingId,
        personId: person.personId,
        personName: person.personName,
        similarity: person.avgSimilarity, // Use average instead of max
        maxSimilarity: person.maxSimilarity,
        photoFileName: person.bestPhotoFileName,
        embeddingCount: person.embeddingCount
      }))
      .sort((a, b) => b.similarity - a.similarity);

    // Log top 10 aggregated scores per person
    context.log('Top 10 aggregated scores (by average):', personMatches.slice(0, 10).map(p => 
      `${p.personName}: avg=${(p.similarity * 100).toFixed(1)}%, max=${(p.maxSimilarity * 100).toFixed(1)}%, count=${p.embeddingCount}`
    ));

    // Filter by threshold and take top N
    const matches = personMatches.filter(p => p.similarity >= threshold);
    const uniqueMatches = matches.slice(0, topN);

    context.log(`Identified ${uniqueMatches.length} potential matches above threshold ${threshold}`);

    context.res = {
      status: 200,
      body: {
        success: true,
        matches: uniqueMatches,
        totalEmbeddings: storedEmbeddings.length
      }
    };

  } catch (err) {
    context.log.error('Error identifying face:', err);
    
    // Import DatabaseWarmupError check from db module
    const { DatabaseWarmupError, isDatabaseWarmupError } = require('../shared/db');
    
    // Check if this is a database warmup error
    if (err instanceof DatabaseWarmupError || isDatabaseWarmupError(err)) {
      context.res = {
        status: 503, // Service Unavailable
        body: {
          success: false,
          error: 'Database is warming up. Please wait a moment and try again.',
          isWarmup: true
        }
      };
    } else {
      context.res = {
        status: 500,
        body: {
          success: false,
          error: err.message || 'Error identifying face'
        }
      };
    }
  }
};
