const { query } = require('../shared/db');

/**
 * One-time setup endpoint to activate initial admin accounts
 */
module.exports = async function (context, req) {
  context.log('Setup admin called');

  try {
    // Check if any Active Admin users exist
    const adminUsers = await query(
      `SELECT COUNT(*) as count FROM Users WHERE Role = 'Admin' AND Status = 'Active'`
    );

    context.log('Admin check result:', adminUsers);

    if (adminUsers.length > 0 && adminUsers[0].count > 0) {
      context.res = { 
        status: 403, 
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Admin users already exist' } 
      };
      return;
    }

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

    context.log('Final result:', result);

    context.res = { 
      status: 200,
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: { error: error.message }
    };
  }
};
