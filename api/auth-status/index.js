const { checkAuthorization, getUserEmail, getUserName } = require('../shared/auth');

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
        error: authResult.error
      }
    };

  } catch (error) {
    context.log.error('Error checking auth status:', error);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: error.message || 'Internal server error'
      }
    };
  }
};
