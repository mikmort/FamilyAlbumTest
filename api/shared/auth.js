const { query } = require('./db');

/**
 * Authorization utilities for role-based access control
 */

// Role hierarchy - higher number = more permissions
const ROLE_HIERARCHY = {
  'Admin': 3,
  'Full': 2,
  'Read': 1,
  'None': 0
};

/**
 * Get user from database by email
 */
async function getUserByEmail(email) {
  if (!email) return null;
  
  const result = await query(
    `SELECT ID, Email, Role, Status, LastLoginAt, Notes 
     FROM Users 
     WHERE Email = @email`,
    { email: email.toLowerCase() }
  );
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Get or create user record
 * If user doesn't exist, creates with Pending status
 */
async function getOrCreateUser(email, name = null) {
  let user = await getUserByEmail(email);
  
  if (!user) {
    // Create new user with Pending status
    await query(
      `INSERT INTO Users (Email, Role, Status, Notes) 
       VALUES (@email, 'Read', 'Pending', @notes)`,
      { 
        email: email.toLowerCase(),
        notes: name ? `Requested by: ${name}` : 'Auto-created on first login'
      }
    );
    user = await getUserByEmail(email);
  }
  
  return user;
}

/**
 * Update user's last login time
 */
async function updateLastLogin(email) {
  await query(
    `UPDATE Users SET LastLoginAt = GETDATE() WHERE Email = @email`,
    { email: email.toLowerCase() }
  );
}

/**
 * Check if user has required permission level
 */
function hasPermission(userRole, requiredRole) {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Extract user email from Azure Static Web Apps auth
 */
function getUserEmail(context) {
  const principal = context.req.headers['x-ms-client-principal'];
  if (!principal) return null;
  
  try {
    const decoded = Buffer.from(principal, 'base64').toString('ascii');
    const user = JSON.parse(decoded);
    
    // Try to get email from claims
    if (user.claims) {
      const emailClaim = user.claims.find(c => 
        c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress' ||
        c.typ === 'emails' ||
        c.typ === 'email'
      );
      if (emailClaim) return emailClaim.val.toLowerCase();
    }
    
    // Fallback to userDetails
    if (user.userDetails) {
      return user.userDetails.toLowerCase();
    }
    
    return null;
  } catch (err) {
    context.log.error('Error parsing user principal:', err);
    return null;
  }
}

/**
 * Get user name from Azure Static Web Apps auth
 */
function getUserName(context) {
  const principal = context.req.headers['x-ms-client-principal'];
  if (!principal) return null;
  
  try {
    const decoded = Buffer.from(principal, 'base64').toString('ascii');
    const user = JSON.parse(decoded);
    
    if (user.claims) {
      const nameClaim = user.claims.find(c => 
        c.typ === 'name' ||
        c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
      );
      if (nameClaim) return nameClaim.val;
    }
    
    return user.userDetails || null;
  } catch (err) {
    return null;
  }
}

/**
 * Middleware to check user authorization
 * Returns { authorized, user, error } object
 * 
 * DEV MODE: Set DEV_MODE=true in environment to bypass authentication for testing.
 * Optionally set DEV_USER_EMAIL and DEV_USER_ROLE to simulate a specific user.
 */
async function checkAuthorization(context, requiredRole = 'Read') {
  // Dev mode bypass for testing (only in development)
  if (process.env.DEV_MODE === 'true') {
    const devEmail = process.env.DEV_USER_EMAIL || 'dev@example.com';
    const devRole = process.env.DEV_USER_ROLE || 'Admin';
    
    context.log.warn(`DEV MODE: Bypassing authentication. User: ${devEmail}, Role: ${devRole}`);
    
    return {
      authorized: true,
      user: {
        ID: 0,
        Email: devEmail,
        Role: devRole,
        Status: 'Active',
        LastLoginAt: new Date(),
        Notes: 'Dev mode user'
      },
      error: null
    };
  }
  
  const email = getUserEmail(context);
  
  if (!email) {
    return {
      authorized: false,
      user: null,
      error: 'No authenticated user found'
    };
  }
  
  // Get or create user
  const name = getUserName(context);
  const user = await getOrCreateUser(email, name);
  
  // Update last login
  await updateLastLogin(email);
  
  // Check if user is active
  if (user.Status !== 'Active') {
    return {
      authorized: false,
      user: user,
      error: user.Status === 'Pending' 
        ? 'Access pending approval' 
        : user.Status === 'Denied'
        ? 'Access has been denied'
        : 'Account is suspended'
    };
  }
  
  // Check role permission
  if (!hasPermission(user.Role, requiredRole)) {
    return {
      authorized: false,
      user: user,
      error: `Insufficient permissions. Required: ${requiredRole}, You have: ${user.Role}`
    };
  }
  
  return {
    authorized: true,
    user: user,
    error: null
  };
}

/**
 * Get all pending access requests (Admin only)
 */
async function getPendingRequests() {
  return await query(
    `SELECT ID, Email, RequestedAt, Notes,
            DATEDIFF(HOUR, RequestedAt, GETDATE()) as HoursSinceRequest
     FROM Users 
     WHERE Status = 'Pending'
     ORDER BY RequestedAt ASC`
  );
}

/**
 * Get all users (Admin only)
 */
async function getAllUsers() {
  return await query(
    `SELECT ID, Email, Role, Status, RequestedAt, ApprovedAt, 
            ApprovedBy, LastLoginAt, Notes, CreatedAt, UpdatedAt
     FROM Users 
     ORDER BY 
       CASE Status 
         WHEN 'Active' THEN 1 
         WHEN 'Pending' THEN 2 
         WHEN 'Suspended' THEN 3 
         WHEN 'Denied' THEN 4 
       END,
       Email`
  );
}

/**
 * Update user role and status (Admin only)
 */
async function updateUser(userId, updates, adminEmail) {
  const { role, status, notes } = updates;
  
  let sql = 'UPDATE Users SET UpdatedAt = GETDATE()';
  const params = { userId };
  
  if (role) {
    sql += ', Role = @role';
    params.role = role;
  }
  
  if (status) {
    sql += ', Status = @status';
    params.status = status;
    
    if (status === 'Active') {
      sql += ', ApprovedAt = GETDATE(), ApprovedBy = @adminEmail';
      params.adminEmail = adminEmail;
    }
  }
  
  if (notes !== undefined) {
    sql += ', Notes = @notes';
    params.notes = notes;
  }
  
  sql += ' WHERE ID = @userId';
  
  await query(sql, params);
}

/**
 * Add new user (Admin only)
 */
async function addUser(email, role, status, notes, adminEmail) {
  await query(
    `INSERT INTO Users (Email, Role, Status, ApprovedAt, ApprovedBy, Notes)
     VALUES (@email, @role, @status, @approvedAt, @adminEmail, @notes)`,
    {
      email: email.toLowerCase(),
      role,
      status,
      approvedAt: status === 'Active' ? new Date() : null,
      adminEmail: status === 'Active' ? adminEmail : null,
      notes
    }
  );
}

/**
 * Delete user (Admin only)
 */
async function deleteUser(userId) {
  await query('DELETE FROM Users WHERE ID = @userId', { userId });
}

module.exports = {
  getUserByEmail,
  getOrCreateUser,
  updateLastLogin,
  hasPermission,
  getUserEmail,
  getUserName,
  checkAuthorization,
  getPendingRequests,
  getAllUsers,
  updateUser,
  addUser,
  deleteUser,
  ROLE_HIERARCHY
};
