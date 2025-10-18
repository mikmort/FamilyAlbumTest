// Test the media API locally to catch runtime errors
const mediaFunction = require('../api/media/index.js');

// Mock context object
const context = {
    log: (...args) => console.log('[LOG]', ...args),
    res: null
};
context.log.error = (...args) => console.error('[ERROR]', ...args);
context.log.warn = (...args) => console.warn('[WARN]', ...args);

// Mock request object
const req = {
    method: 'GET',
    url: "/api/media/Devorah's Wedding/PA130080.JPG",
    params: {
        filename: "Devorah's Wedding/PA130080.JPG"
    },
    query: {}
};

// Run the function
(async () => {
    try {
        console.log('Testing media API function...\n');
        await mediaFunction(context, req);
        console.log('\nResponse status:', context.res?.status);
        console.log('Response body:', context.res?.body);
    } catch (err) {
        console.error('\nCaught error:', err.message);
        console.error('Stack:', err.stack);
    }
})();
