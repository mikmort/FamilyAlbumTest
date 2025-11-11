const { query } = require('../shared/db');
const { checkAuthorization } = require('../shared/auth');

/**
 * Clear Face Embeddings
 * 
 * Deletes all face embeddings from the database.
 * Use this when switching face recognition systems or to start fresh.
 * 
 * DELETE /api/faces-clear
 */
module.exports = async function (context, req) {
  context.log('Clear face embeddings request');

  try {
    // Check authorization - requires Admin role for this destructive operation
    const { authorized, user, error } = await checkAuthorization(context, 'Admin');
    if (!authorized) {
      context.res = {
        status: 403,
        body: { error: error || 'Admin access required to clear embeddings' }
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
    // Get count before deletion
    const countResult = await query('SELECT COUNT(*) as total FROM dbo.FaceEmbeddings');
    const totalBefore = countResult[0]?.total || 0;

    // Delete all embeddings
    await query('DELETE FROM dbo.FaceEmbeddings');

    // Also clear training progress
    await query('DELETE FROM dbo.FaceTrainingProgress');

    context.log(`Cleared ${totalBefore} face embeddings`);

    context.res = {
      status: 200,
      body: {
        success: true,
        message: `Successfully cleared ${totalBefore} face embeddings`,
        deletedCount: totalBefore
      }
    };

  } catch (err) {
    context.log.error('Error clearing face embeddings:', err);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: err.message || 'Error clearing face embeddings'
      }
    };
  }
};
