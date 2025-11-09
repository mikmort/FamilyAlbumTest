const { query } = require('../shared/db');

/**
 * Database warmup endpoint
 * This endpoint is called when the app first loads to wake up the serverless database
 * before the user attempts to log in. It makes a simple, fast query that doesn't
 * expose any sensitive data.
 * 
 * This is intentionally anonymous (no auth required) so it can be called immediately
 * when the page loads, even before authentication.
 */
module.exports = async function (context, req) {
  context.log('Database warmup check called');

  try {
    // Execute a simple, fast query that doesn't expose sensitive data
    // This will wake up the database if it's paused (serverless tier)
    // Using a system query that's guaranteed to exist and be fast
    await query('SELECT 1 AS WarmupCheck');

    context.res = {
      status: 200,
      body: {
        success: true,
        warmed: true
      }
    };

  } catch (error) {
    context.log.error('Error warming database:', error);
    
    // Even if there's an error, we return success because the attempt
    // to connect likely started the database warmup process
    context.res = {
      status: 200,
      body: {
        success: true,
        warmed: false,
        warming: true
      }
    };
  }
};
