const { query } = require('../shared/db');

function isDevModeEnabled() {
  const devMode = (process.env.DEV_MODE || '').toLowerCase() === 'true';
  if (!devMode) return false;

  const isProduction =
    (process.env.NODE_ENV || '').toLowerCase() === 'production' ||
    (process.env.AZURE_FUNCTIONS_ENVIRONMENT || '').toLowerCase() === 'production' ||
    Boolean(process.env.WEBSITE_SITE_NAME);

  return !isProduction;
}

/**
 * rolesSource endpoint for Azure Static Web Apps.
 * SWA calls this (POST) after sign-in to determine the user's custom roles.
 * Must return { "roles": [...] } - all roles including "authenticated" must be explicit.
 */
module.exports = async function (context, req) {
  context.log('get-roles called');

  try {
    // Dev mode bypass
    if (isDevModeEnabled()) {
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

    // Extract all candidate emails from claims - Microsoft accounts can have multiple
    // aliases (e.g. jb_morton@live.com and jbm@mikmorthotmail.onmicrosoft.com are the same account).
    // We collect ALL email-like claims and try each one against the database.
    const isEmailLike = (value) => typeof value === 'string' && value.includes('@');
    const candidateEmails = [];

    if (user.claims) {
      // Priority order: real email addresses first, then UPN/preferred_username aliases
      const claimPriority = [
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        'email',
        'emails',
        'preferred_username',
        'upn',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn',
      ];
      for (const typ of claimPriority) {
        const claim = user.claims.find(c => c.typ === typ);
        if (claim && isEmailLike(claim.val)) {
          const val = claim.val.toLowerCase();
          if (!candidateEmails.includes(val)) candidateEmails.push(val);
        }
      }
      // Also pick up any other email-like claims not in the list above
      for (const claim of user.claims) {
        if (isEmailLike(claim.val)) {
          const val = claim.val.toLowerCase();
          if (!candidateEmails.includes(val)) candidateEmails.push(val);
        }
      }
    }
    if (isEmailLike(user.userDetails)) {
      const val = user.userDetails.toLowerCase();
      if (!candidateEmails.includes(val)) candidateEmails.push(val);
    }

    context.log('Candidate emails for role lookup:', candidateEmails);

    if (candidateEmails.length === 0) {
      return { status: 200, body: { roles: ['authenticated'] } };
    }

    // Try each candidate email against the database until we find a match.
    // This handles the case where Microsoft returns an onmicrosoft.com alias
    // but the user is registered with their live.com or other personal email.
    let dbUser = null;
    for (const email of candidateEmails) {
      context.log('Checking roles for:', email);
      const result = await query(
        `SELECT Role, Status, Email FROM Users WHERE Email = @email`,
        { email }
      );
      if (result && result.length > 0) {
        dbUser = result[0];
        context.log('User found via email:', email, dbUser.Role, dbUser.Status);
        break;
      }
    }

    if (!dbUser) {
      // Unknown user - still authenticated, app will handle pending state
      context.log('User not found for any candidate email:', candidateEmails);
      return { status: 200, body: { roles: ['authenticated'] } };
    }

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
