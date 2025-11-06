const { checkAuthorization } = require('../../shared/auth');
const { query } = require('../../shared/db');

/**
 * Check Training Status Endpoint
 * 
 * Checks if baseline training has been completed by counting
 * how many people have been added to Azure Face API.
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

  try {
    // Check authorization - requires Admin role
    const { authorized, user, error } = await checkAuthorization(context, 'Admin');
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
    // Count how many people have been added to Azure Face API
    const result = await query(
      `SELECT COUNT(DISTINCT PersonID) as TrainedCount
       FROM dbo.AzureFacePersons
       WHERE AzurePersonID IS NOT NULL`
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
