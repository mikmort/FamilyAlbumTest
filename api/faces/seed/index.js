const { checkAuthorization } = require('../shared/auth');

/**
 * Face Seeding Proxy Endpoint
 * 
 * Seeds face encodings from existing manually-tagged photos.
 * This processes photos in NamePhoto table that haven't been processed yet.
 * Requires Admin role.
 * 
 * POST /api/faces/seed
 * Body (optional): { 
 *   "limit": 100,          // Max photos to process per run
 *   "maxPerPerson": 5      // Max photos per person (for baseline training)
 * }
 */
module.exports = async function (context, req) {
  context.log('Face seeding proxy processing request');

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
    const pythonFunctionUrl = process.env.PYTHON_FUNCTION_APP_URL || 'https://familyalbum-faces-api.azurewebsites.net';
    
    // Forward request to Python function
    const response = await fetch(`${pythonFunctionUrl}/api/faces/seed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body || {})
    });

    const data = await response.json();

    context.res = {
      status: response.status,
      body: data
    };

  } catch (err) {
    context.log.error('Error in face seeding proxy:', err);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: err.message || 'Error processing seeding request'
      }
    };
  }
};
