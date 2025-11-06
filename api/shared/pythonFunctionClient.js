/**
 * HTTP client for calling Python Azure Function App endpoints
 * This handles communication between the Node.js API and Python face recognition functions
 */

const https = require('https');

// Get Python Function App URL from environment
const PYTHON_FUNCTION_URL = process.env.PYTHON_FUNCTION_APP_URL || 'https://familyalbum-faces-api.azurewebsites.net';

/**
 * Make HTTP request to Python Function App
 * @param {string} endpoint - API endpoint (e.g., '/api/detect-faces')
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {Object} data - Request body (for POST/PUT)
 * @param {Object} context - Azure Function context for logging
 * @returns {Promise<Object>} Response data
 */
async function callPythonFunction(endpoint, method = 'GET', data = null, context = null) {
    const url = new URL(endpoint, PYTHON_FUNCTION_URL);
    
    return new Promise((resolve, reject) => {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            const bodyData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(bodyData);
        }

        if (context) {
            context.log(`Calling Python Function: ${method} ${url.href}`);
        }

        const req = https.request(url, options, (res) => {
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
                        if (context) {
                            context.log.error(`Python Function returned ${res.statusCode}: ${body}`);
                        }
                        reject(new Error(`Python Function returned ${res.statusCode}: ${body}`));
                    }
                } catch (error) {
                    if (context) {
                        context.log.error('Failed to parse Python Function response:', error);
                    }
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            if (context) {
                context.log.error('Error calling Python Function:', error);
            }
            reject(error);
        });

        if (data && (method === 'POST' || method === 'PUT')) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

/**
 * Trigger face detection for an uploaded image
 * @param {string} filename - Name of the uploaded file
 * @param {boolean} autoConfirm - Whether to auto-confirm high-confidence matches
 * @param {Object} context - Azure Function context
 * @returns {Promise<Object>} Detection results
 */
async function detectFaces(filename, autoConfirm = false, context = null) {
    return callPythonFunction(
        '/api/detect-faces',
        'POST',
        { filename, autoConfirm },
        context
    );
}

/**
 * Get pending face suggestions for review
 * @param {number} limit - Maximum number of suggestions to return
 * @param {Object} context - Azure Function context
 * @returns {Promise<Array>} Pending face suggestions
 */
async function getPendingFaces(limit = 50, context = null) {
    return callPythonFunction(
        `/api/faces/review?limit=${limit}`,
        'GET',
        null,
        context
    );
}

/**
 * Confirm or reject a face suggestion
 * @param {Object} data - Action data { faceId, action: 'confirm'|'reject', personId }
 * @param {Object} context - Azure Function context
 * @returns {Promise<Object>} Result of the action
 */
async function reviewFace(data, context = null) {
    return callPythonFunction(
        '/api/faces/review',
        'POST',
        data,
        context
    );
}

/**
 * Trigger training to regenerate person encodings
 * @param {Object} context - Azure Function context
 * @returns {Promise<Object>} Training results
 */
async function trainFaces(context = null) {
    return callPythonFunction(
        '/api/faces/train',
        'POST',
        {},
        context
    );
}

/**
 * Get faces detected in a specific image
 * @param {string} filename - Image filename
 * @param {Object} context - Azure Function context
 * @returns {Promise<Array>} Detected faces with suggestions
 */
async function getImageFaces(filename, context = null) {
    return callPythonFunction(
        `/api/detect-faces?filename=${encodeURIComponent(filename)}`,
        'GET',
        null,
        context
    );
}

module.exports = {
    detectFaces,
    getPendingFaces,
    reviewFace,
    trainFaces,
    getImageFaces,
    callPythonFunction
};
