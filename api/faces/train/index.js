const { checkAuthorization } = require('../shared/auth');

/**
 * Face Training Proxy Endpoint
 * 
 * Proxies training requests to the Python Function App.
 * Requires Admin role.
 * 
 * POST /api/faces/train - Train all persons or specific person
 * Body (optional): { "personId": 123 }
 */
module.exports = async function (context, req) {
  context.log('Face training proxy processing request');

  // Check authorization - requires Admin role for manual training
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
    const response = await fetch(`${pythonFunctionUrl}/api/faces/train`, {
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
    context.log.error('Error in face training proxy:', err);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: err.message || 'Error processing training request'
      }
    };
  }
};
