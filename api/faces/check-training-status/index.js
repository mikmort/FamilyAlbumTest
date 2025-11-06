const { checkAuthorization } = require('../../shared/auth');
const { query } = require('../../shared/db');

/**
 * Check Training Status Endpoint
 * 
 * Checks if baseline training has been completed by counting
 * how many people have trained encodings in PersonEncodings table.
 * Requires Admin role.
 * 
 * GET /api/faces/check-training-status
 * 
 * Returns: {
 *   "success": true,
 *   "trainedPersons": 42
 * }
 */
module.exports = async function (context, req) {
  context.log('Check training status processing request');

  // Check authorization - requires Admin role
  const { authorized, user, error } = await checkAuthorization(context, 'Admin');
  if (!authorized) {
    context.res = {
      status: 403,
      body: { error }
    };
    return;
  }

  try {
    // Count how many people have trained encodings
    const result = await query(
      `SELECT COUNT(DISTINCT PersonID) as TrainedCount
       FROM dbo.PersonEncodings
       WHERE Encoding IS NOT NULL`
    );

    const trainedPersons = result[0]?.TrainedCount || 0;

    context.res = {
      status: 200,
      body: {
        success: true,
        trainedPersons: trainedPersons
      }
    };

  } catch (err) {
    context.log.error('Error checking training status:', err);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: err.message || 'Error checking training status'
      }
    };
  }
};
