const { checkAuthorization } = require('../shared/auth');

/**
 * Face Review Proxy Endpoint
 * 
 * Proxies requests to the Python Function App for face review operations.
 * After confirming faces, triggers automatic training check.
 * 
 * GET /api/faces/review?limit=50 - Get faces needing review
 * POST /api/faces/review - Confirm or reject face match
 */
module.exports = async function (context, req) {
  context.log('Face review proxy processing request');

  // Check authorization - requires Full role
  const { authorized, user, error } = await checkAuthorization(context, 'Full');
  if (!authorized) {
    context.res = {
      status: 403,
      body: { error }
    };
    return;
  }

  try {
    const pythonFunctionUrl = process.env.PYTHON_FUNCTION_APP_URL || 'https://familyalbum-faces-api.azurewebsites.net';
    const method = req.method;
    
    // Build URL with query params for GET requests
    let url = `${pythonFunctionUrl}/api/faces/review`;
    if (method === 'GET' && req.query.limit) {
      url += `?limit=${req.query.limit}`;
    }

    // Forward request to Python function
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: method === 'POST' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.json();

    // If this was a confirm action, trigger auto-training check
    if (method === 'POST' && req.body.action === 'confirm' && data.success) {
      context.log('Face confirmed, triggering auto-training check');
      
      // Call auto-training endpoint (don't wait for it)
      fetch(`${process.env.WEBSITE_HOSTNAME || 'http://localhost:7071'}/api/faces-auto-train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(autoTrainRes => {
        return autoTrainRes.json();
      }).then(autoTrainData => {
        context.log('Auto-training check result:', autoTrainData);
      }).catch(err => {
        context.log.error('Auto-training check failed (non-blocking):', err.message);
      });
    }

    context.res = {
      status: response.status,
      body: data
    };

  } catch (err) {
    context.log.error('Error in face review proxy:', err);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: err.message || 'Error processing face review request'
      }
    };
  }
};
