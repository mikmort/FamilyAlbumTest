const { checkAuthorization } = require('../shared/auth');
const { query } = require('../shared/db');

/**
 * Add Face Embedding Endpoint
 * 
 * Stores face embeddings (128-dim face-api.js or 512-dim InsightFace) for a person from a specific photo.
 * This endpoint is called from the client after generating embeddings.
 * 
 * POST /api/faces/add-embedding
 * 
 * Body: {
 *   "personId": 123,
 *   "photoFileName": "photo.jpg",
 *   "embedding": [0.123, -0.456, ...], // 128 or 512 floats
 *   "modelVersion": "insightface-arcface" | "face-api-js",
 *   "embeddingDimensions": 512 | 128
 * }
 * 
 * Returns: {
 *   "success": true,
 *   "embeddingId": 456
 * }
 */
module.exports = async function (context, req) {
  context.log('Add face embedding processing request');

  try {
    // Check authorization - requires Full role
    const { authorized, user, error } = await checkAuthorization(context, 'Full');
    if (!authorized) {
      context.res = {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
        body: { error }
      };
      return;
    }
  } catch (authError) {
    context.log.error('Authorization error:', authError);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Authorization check failed', details: authError.message }
    };
    return;
  }

  try {
    const { personId, photoFileName, embedding, modelVersion, embeddingDimensions } = req.body;

    // Validate input
    if (!personId || !photoFileName || !embedding) {
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Missing required fields: personId, photoFileName, embedding' }
      };
      return;
    }

    // Default to face-api.js for backward compatibility
    const model = modelVersion || 'face-api-js';
    const dimensions = embeddingDimensions || 128;

    // Validate embedding dimensions
    if (!Array.isArray(embedding) || embedding.length !== dimensions) {
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: `Embedding must be an array of ${dimensions} floats for ${model}` }
      };
      return;
    }

    // Convert embedding array to JSON string for storage
    const embeddingJson = JSON.stringify(embedding);

    // Check if embedding already exists for this person/photo/model combo
    const existing = await query(
      `SELECT ID FROM dbo.FaceEmbeddings 
       WHERE PersonID = @personId 
       AND PhotoFileName = @photoFileName 
       AND ModelVersion = @modelVersion`,
      { personId, photoFileName, modelVersion: model }
    );

    let embeddingId;

    if (existing && existing.length > 0) {
      // Update existing embedding
      embeddingId = existing[0].ID;
      await query(
        `UPDATE dbo.FaceEmbeddings 
         SET Embedding = @embedding, 
             ModelVersion = @modelVersion,
             EmbeddingDimensions = @embeddingDimensions,
             UpdatedDate = GETDATE()
         WHERE ID = @id`,
        { 
          id: embeddingId, 
          embedding: embeddingJson,
          modelVersion: model,
          embeddingDimensions: dimensions
        }
      );
      context.log(`Updated ${model} embedding ${embeddingId} (${dimensions}-dim) for person ${personId}, photo ${photoFileName}`);
    } else {
      // Insert new embedding
      const result = await query(
        `INSERT INTO dbo.FaceEmbeddings 
         (PersonID, PhotoFileName, Embedding, ModelVersion, EmbeddingDimensions)
         OUTPUT INSERTED.ID
         VALUES (@personId, @photoFileName, @embedding, @modelVersion, @embeddingDimensions)`,
        { 
          personId, 
          photoFileName, 
          embedding: embeddingJson,
          modelVersion: model,
          embeddingDimensions: dimensions
        }
      );
      embeddingId = result[0].ID;
      context.log(`Created ${model} embedding ${embeddingId} (${dimensions}-dim) for person ${personId}, photo ${photoFileName}`);
    }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        embeddingId: embeddingId
      }
    };

  } catch (err) {
    context.log.error('Error adding face embedding:', err);
    
    // Import DatabaseWarmupError check from db module
    const { DatabaseWarmupError, isDatabaseWarmupError } = require('../shared/db');
    
    // Check if this is a database warmup error
    if (err instanceof DatabaseWarmupError || isDatabaseWarmupError(err)) {
      context.res = {
        status: 503, // Service Unavailable
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: false,
          error: 'Database is warming up. Please wait a moment and try again.',
          isWarmup: true
        }
      };
    } else {
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: false,
          error: err.message || 'Error adding face embedding'
        }
      };
    }
  }
};
