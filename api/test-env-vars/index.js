module.exports = async function (context, req) {
    context.log('Test env vars endpoint called');

    const envVars = {
        AZURE_COMMUNICATION_CONNECTION_STRING: process.env.AZURE_COMMUNICATION_CONNECTION_STRING ? 'SET (length: ' + process.env.AZURE_COMMUNICATION_CONNECTION_STRING.length + ')' : 'NOT SET',
        EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS || 'NOT SET',
        SITE_URL: process.env.SITE_URL || 'NOT SET',
        SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV || 'NOT SET',
        // Check if the package is available
        communicationEmailPackage: null
    };

    // Try to load the package
    try {
        const pkg = require('@azure/communication-email');
        envVars.communicationEmailPackage = 'AVAILABLE';
    } catch (err) {
        envVars.communicationEmailPackage = 'NOT AVAILABLE: ' + err.message;
    }

    context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: envVars
    };
};
