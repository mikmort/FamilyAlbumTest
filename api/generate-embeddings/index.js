const { checkAuthorization } = require('../shared/auth');
const https = require('https');
const http = require('http');

/**
 * Generate Face Embeddings (Proxy to Python API)
 * 
 * This endpoint proxies requests to the Python Function App which uses InsightFace
 * to generate 512-dimensional face embeddings for better recognition accuracy.
 * 
 * POST /api/generate-embeddings
 * Body: {
 *   "imageUrl": "https://..." // URL to image with SAS token
 * }
 * 
 * Returns: {
 *   "success": true,
 *   "embedding": [512 floats],
 *   "confidence": 0.99,
 *   "faceCount": 1,
 *   "dimensions": 512,
 *   "model": "buffalo_l_arcface"
 * }
 */
module.exports = async function (context, req) {
  context.log('Generate embeddings proxy request');

  try {
    // Check authorization - requires Full role for training
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
    const { imageUrl } = req.body;

    if (!imageUrl) {
      context.res = {
        status: 400,
        body: { error: 'imageUrl is required' }
      };
      return;
    }

    // Get Python Function App URL from environment
    const pythonFunctionUrl = process.env.PYTHON_FUNCTION_APP_URL || 'http://localhost:7072';
    const endpoint = `${pythonFunctionUrl}/api/generate-embeddings`;

    context.log(`Proxying request to Python API: ${endpoint}`);

    // Forward request to Python Function App
    const result = await forwardToPythonAPI(endpoint, { imageUrl }, context);

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: result
    };

  } catch (err) {
    context.log.error('Error proxying to Python API:', err);
    
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: false,
        error: 'Failed to generate embedding',
        details: err.message
      }
    };
  }
};

/**
 * Forward request to Python Function App
 * @param {string} url - Full URL to Python endpoint
 * @param {Object} data - Request body
 * @param {Object} context - Azure Function context for logging
 * @returns {Promise<Object>} Response from Python API
 */
function forwardToPythonAPI(url, data, context) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const bodyData = JSON.stringify(data);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData)
      },
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname
    };

    const req = httpModule.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const responseData = body ? JSON.parse(body) : {};
            resolve(responseData);
          } else {
            context.log.error(`Python API error: ${res.statusCode} - ${body}`);
            reject(new Error(`Python API returned ${res.statusCode}: ${body.substring(0, 200)}`));
          }
        } catch (err) {
          context.log.error('Error parsing Python API response:', err);
          reject(new Error(`Failed to parse Python API response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      context.log.error('Request to Python API failed:', err);
      reject(new Error(`Failed to connect to Python API: ${err.message}`));
    });

    req.write(bodyData);
    req.end();
  });
}
