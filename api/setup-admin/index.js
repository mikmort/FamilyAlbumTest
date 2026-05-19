const { query } = require('../shared/db');

/**
 * One-time setup endpoint to activate initial admin accounts
 */
module.exports = async function (context, req) {
  context.log('Setup admin called');

  try {
    // Upsert the primary admin account - inserts if deleted, updates if exists
    const emails = [
      'jb_morton@live.com',
      'jbm@mikmorthotmail.onmicrosoft.com',
    ];

    for (const email of emails) {
      context.log('Upserting:', email);
      await query(
        `MERGE Users AS target
         USING (SELECT @email AS Email) AS source ON target.Email = source.Email
         WHEN MATCHED THEN
           UPDATE SET Role = 'Admin', Status = 'Active', ApprovedAt = GETDATE(), UpdatedAt = GETDATE()
         WHEN NOT MATCHED THEN
           INSERT (Email, Role, Status, ApprovedAt, CreatedAt, UpdatedAt)
           VALUES (@email, 'Admin', 'Active', GETDATE(), GETDATE(), GETDATE());`,
        { email: email.toLowerCase() }
      );
    }

    // Verify the updates
    const result = await query(
      `SELECT Email, Role, Status FROM Users WHERE Email IN ('jb_morton@live.com', 'jbm@mikmorthotmail.onmicrosoft.com')`
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
