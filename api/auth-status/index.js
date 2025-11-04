const { checkAuthorization, getUserEmail, getUserName, getPendingRequests } = require('../shared/auth');
const { DatabaseWarmupError } = require('../shared/db');

module.exports = async function (context, req) {
  context.log('Auth status check called');

  try {
    const email = getUserEmail(context);
    const name = getUserName(context);

    if (!email) {
      context.res = {
        status: 401,
        body: {
          success: false,
          authenticated: false,
          error: 'Not authenticated'
        }
      };
      return;
    }

    // Check authorization (this will create user if doesn't exist)
    const authResult = await checkAuthorization(context, 'Read');

    // If user is admin, get pending request count
    let pendingCount = 0;
    if (authResult.user?.Role === 'Admin') {
      const pendingRequests = await getPendingRequests();
      pendingCount = pendingRequests.length;
    }

    context.res = {
      status: 200,
      body: {
        success: true,
        authenticated: true,
        authorized: authResult.authorized,
        user: {
          email: authResult.user?.Email,
          name: name,
          role: authResult.user?.Role,
          status: authResult.user?.Status,
          lastLogin: authResult.user?.LastLoginAt
        },
        pendingCount: pendingCount,
        error: authResult.error
      }
    };

  } catch (error) {
    context.log.error('Error checking auth status:', error);
    
    // Check if this is a database warmup error
    if (error.isWarmupError || error instanceof DatabaseWarmupError) {
      context.res = {
        status: 503, // Service Unavailable
        body: {
          success: false,
          databaseWarming: true,
          error: 'Database is warming up. Please wait a moment...'
        }
      };
      return;
    }
    
    context.res = {
      status: 500,
      body: {
        success: false,
        error: error.message || 'Internal server error'
      }
    };
  }
};
