/**
 * rolesSource endpoint for Azure Static Web Apps.
 * SWA calls this (POST) after sign-in to determine the user's custom roles.
 *
 * This endpoint intentionally does NOT query the database. Its only job is
 * to tell SWA whether the user is authenticated so they can access the app.
 * All DB-based RBAC (Admin/Full/Read) is handled by /api/auth-status which
 * is called by the app after login.
 *
 * Keeping this DB-free ensures login never hangs due to a cold database
 * (which previously caused a login redirect loop in private/incognito windows).
 */
module.exports = async function (context, req) {
  context.log('get-roles called');

  // Any user who reaches this endpoint has completed Microsoft/Google OAuth.
  // Grant 'authenticated' so they can access the app and see their status.
  const principal = req.headers['x-ms-client-principal'];
  if (!principal) {
    context.log('No client principal - returning empty roles');
    return { status: 200, body: { roles: [] } };
  }

  context.log('Principal present - returning authenticated');
  return { status: 200, body: { roles: ['authenticated'] } };
};
