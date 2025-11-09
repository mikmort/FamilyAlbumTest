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
 * @param {number[]} embedding1 - First 128-dim embedding
 * @param {number[]} embedding2 - Second 128-dim embedding
 * @returns {number} Similarity score between 0 and 1 (1 - normalized distance)
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
  
  // face-api.js considers distance < 0.6 as a match
  // Convert to similarity score: smaller distance = higher similarity
  // Max realistic distance is ~2 for normalized vectors
  const similarity = Math.max(0, 1 - (distance / 2));
  
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
    const { embedding, threshold = 0.6, topN = 5 } = req.body;

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
    const matches = [];
    for (const stored of storedEmbeddings) {
      try {
        const storedEmbedding = JSON.parse(stored.Embedding);
        
        // Use Euclidean distance (face-api.js default) instead of cosine similarity
        const similarity = euclideanSimilarity(embedding, storedEmbedding);

        if (similarity >= threshold) {
          matches.push({
            embeddingId: stored.ID,
            personId: stored.PersonID,
            personName: stored.PersonName,
            similarity: similarity,
            photoFileName: stored.PhotoFileName
          });
        }
      } catch (parseError) {
        context.log.error(`Error parsing embedding ${stored.ID}:`, parseError);
      }
    }

    // Sort by similarity (highest first) and take top N
    matches.sort((a, b) => b.similarity - a.similarity);
    const topMatches = matches.slice(0, topN);

    // Group by person and get best match per person
    const bestMatchPerPerson = {};
    for (const match of topMatches) {
      if (!bestMatchPerPerson[match.personId] || 
          match.similarity > bestMatchPerPerson[match.personId].similarity) {
        bestMatchPerPerson[match.personId] = match;
      }
    }

    const uniqueMatches = Object.values(bestMatchPerPerson);

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
