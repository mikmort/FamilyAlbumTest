const { query } = require('../shared/db');

/**
 * One-time setup endpoint to activate initial admin accounts
 * This is a temporary setup tool - only works if no Active Admin users exist
 */
module.exports = async function (context, req) {
  context.log('Setup admin called with method:', req.method);

  try {
    // Check if any Active Admin users exist
    const adminUsers = await query(
      `SELECT COUNT(*) as count FROM Users WHERE Role = 'Admin' AND Status = 'Active'`
    );

    if (adminUsers.length > 0 && adminUsers[0].count > 0) {
      context.res = {
        status: 403,
        body: {
          error: 'Admin users already exist. This endpoint can only be used for initial setup.'
        }
      };
      return;
    }

    // Activate the specified admin accounts
    const emails = ['jb_morton@live.com', 'jbm@mikmort.hotwire.microsoft.com'];
    
    for (const email of emails) {
      await query(
        `UPDATE Users SET Role = 'Admin', Status = 'Active', ApprovedAt = GETDATE() 
         WHERE Email = @email`,
        { email: email.toLowerCase() }
      );
      context.log(`Activated: ${email}`);
    }

    // Verify the updates
    const result = await query(
      `SELECT Email, Role, Status FROM Users WHERE Email IN ('jb_morton@live.com', 'jbm@mikmort.hotwire.microsoft.com')`
    );

    context.res = {
      status: 200,
      body: {
        success: true,
        message: 'Admin accounts activated',
        accounts: result
      }
    };

  } catch (error) {
    context.log.error('Setup error:', error);
    context.res = {
      status: 500,
      body: {
        error: error.message || 'Setup failed',
        details: error.toString()
      }
    };
  }
};
