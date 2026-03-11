const { query } = require('../shared/db');

/**
 * rolesSource endpoint for Azure Static Web Apps.
 * SWA calls this (POST) after sign-in to determine the user's custom roles.
 * Must return { "roles": [...] } - all roles including "authenticated" must be explicit.
 */
module.exports = async function (context, req) {
  context.log('get-roles called');

  try {
    // Dev mode bypass
    if (process.env.DEV_MODE === 'true') {
      const devRole = process.env.DEV_USER_ROLE || 'Admin';
      return { status: 200, body: { roles: ['authenticated', devRole] } };
    }

    // Read the clientPrincipal from the SWA header
    const principal = req.headers['x-ms-client-principal'];
    if (!principal) {
      context.log('No client principal header');
      return { status: 200, body: { roles: [] } };
    }

    let user;
    try {
      const decoded = Buffer.from(principal, 'base64').toString('utf8');
      user = JSON.parse(decoded);
    } catch (e) {
      context.log.error('Failed to parse client principal:', e);
      return { status: 200, body: { roles: [] } };
    }

    // Extract email from claims
    let email = null;
    if (user.claims) {
      const emailClaim = user.claims.find(c =>
        c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress' ||
        c.typ === 'emails' ||
        c.typ === 'email'
      );
      if (emailClaim) email = emailClaim.val.toLowerCase();
    }
    if (!email && user.userDetails) {
      email = user.userDetails.toLowerCase();
    }

    context.log('Checking roles for:', email);

    if (!email) {
      return { status: 200, body: { roles: ['authenticated'] } };
    }

    // Look up user in database
    const result = await query(
      `SELECT Role, Status FROM Users WHERE Email = @email`,
      { email }
    );

    if (!result || result.length === 0) {
      // Unknown user - still authenticated, app will handle pending state
      context.log('User not found, returning authenticated only');
      return { status: 200, body: { roles: ['authenticated'] } };
    }

    const dbUser = result[0];
    context.log('User found:', dbUser.Role, dbUser.Status);

    if (dbUser.Status !== 'Active') {
      // Pending/denied users get authenticated so the app can show the status page
      return { status: 200, body: { roles: ['authenticated'] } };
    }

    // Active users get authenticated + their role
    return { status: 200, body: { roles: ['authenticated', dbUser.Role] } };

  } catch (error) {
    context.log.error('get-roles error:', error);
    // Return authenticated so sign-in doesn't fail catastrophically
    return { status: 200, body: { roles: ['authenticated'] } };
  }
};
