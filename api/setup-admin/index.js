const { query } = require('../shared/db');

/**
 * One-time setup endpoint to activate initial admin accounts
 */
module.exports = async function (context, req) {
  context.log('Setup admin called');

  try {
    // Activate the specified admin accounts
    const emails = ['jb_morton@live.com', 'jbm@mikmort.hotwire.microsoft.com'];
    
    for (const email of emails) {
      context.log('Updating:', email);
      await query(
        `UPDATE Users SET Role = 'Admin', Status = 'Active', ApprovedAt = GETDATE() WHERE Email = @email`,
        { email: email.toLowerCase() }
      );
    }

    // Verify the updates
    const result = await query(
      `SELECT Email, Role, Status FROM Users WHERE Email IN ('jb_morton@live.com', 'jbm@mikmort.hotwire.microsoft.com')`
    );

    context.log('Setup complete, result:', result);

    return {
      status: 200,
      body: { 
        success: true, 
        message: 'Admin accounts activated',
        accounts: result
      }
    };

  } catch (error) {
    context.log.error('Setup error:', error);
    return {
      status: 500,
      body: { error: error.message }
    };
  }
};
