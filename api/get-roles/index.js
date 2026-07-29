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

  // SWA calls this endpoint (POST) after the user has successfully completed
  // OAuth with Microsoft or Google.  The client principal may be in the
  // request body (rolesSource protocol) OR in the x-ms-client-principal
  // header (regular API request).  In either case we simply grant
  // 'authenticated' so the user can enter the app; finer-grained RBAC is
  // handled by /api/auth-status.
  const headerPrincipal = req.headers['x-ms-client-principal'];
  const bodyPrincipal   = req.body && (req.body.userId || req.body.userDetails);

  if (!headerPrincipal && !bodyPrincipal) {
    context.log('No principal found in header or body');
  } else {
    context.log('Principal found - granting authenticated');
  }

  // Always return 'authenticated'. SWA only invokes this function after a
  // successful OAuth exchange, so any caller is a real authenticated user.
  return { status: 200, body: { roles: ['authenticated'] } };
};
