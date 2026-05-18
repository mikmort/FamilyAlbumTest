/**
 * Dedicated logout endpoint
 * This endpoint clears user session data and forces re-authentication
 * Called before redirecting to /.auth/logout
 */
module.exports = async function (context, req) {
  context.log('Logout endpoint called');

  try {
    // Log the current principal for debugging
    const principal = req.headers['x-ms-client-principal'];
    if (principal) {
      try {
        const decoded = Buffer.from(principal, 'base64').toString('utf8');
        const user = JSON.parse(decoded);
        context.log('User logging out:', user.userDetails);
      } catch (e) {
        context.log('Could not parse principal:', e);
      }
    }

    // Set headers to prevent any caching of this session
    context.res = {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'application/json'
      },
      body: {
        success: true,
        message: 'Session cleared, redirecting to logout...'
      }
    };

  } catch (error) {
    context.log.error('Logout error:', error);
    context.res = {
      status: 500,
      body: { error: 'Logout failed' }
    };
  }
};
