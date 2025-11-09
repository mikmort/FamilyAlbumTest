const { checkAuthorization } = require('../shared/auth');
const { query } = require('../shared/db');

/**
 * Add Face Embedding Endpoint
 * 
 * Stores a 128-dimensional face embedding for a person from a specific photo.
 * This endpoint is called from the client after face-api.js generates embeddings.
 * 
 * POST /api/faces/add-embedding
 * 
 * Body: {
 *   "personId": 123,
 *   "photoFileName": "photo.jpg",
 *   "embedding": [0.123, -0.456, ...] // 128 floats
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
    const { personId, photoFileName, embedding } = req.body;

    // Validate input
    if (!personId || !photoFileName || !embedding) {
      context.res = {
        status: 400,
        body: { error: 'Missing required fields: personId, photoFileName, embedding' }
      };
      return;
    }

    if (!Array.isArray(embedding) || embedding.length !== 128) {
      context.res = {
        status: 400,
        body: { error: 'Embedding must be an array of 128 floats' }
      };
      return;
    }

    // Convert embedding array to JSON string for storage
    const embeddingJson = JSON.stringify(embedding);

    // Check if embedding already exists for this person/photo combo
    const existing = await query(
      `SELECT ID FROM dbo.FaceEmbeddings 
       WHERE PersonID = @personId AND PhotoFileName = @photoFileName`,
      { personId, photoFileName }
    );

    let embeddingId;

    if (existing && existing.length > 0) {
      // Update existing embedding
      embeddingId = existing[0].ID;
      await query(
        `UPDATE dbo.FaceEmbeddings 
         SET Embedding = @embedding, UpdatedDate = GETDATE()
         WHERE ID = @id`,
        { id: embeddingId, embedding: embeddingJson }
      );
      context.log(`Updated embedding ${embeddingId} for person ${personId}, photo ${photoFileName}`);
    } else {
      // Insert new embedding
      const result = await query(
        `INSERT INTO dbo.FaceEmbeddings (PersonID, PhotoFileName, Embedding)
         OUTPUT INSERTED.ID
         VALUES (@personId, @photoFileName, @embedding)`,
        { personId, photoFileName, embedding: embeddingJson }
      );
      embeddingId = result[0].ID;
      context.log(`Created embedding ${embeddingId} for person ${personId}, photo ${photoFileName}`);
    }

    context.res = {
      status: 200,
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
          error: err.message || 'Error adding face embedding'
        }
      };
    }
  }
};
