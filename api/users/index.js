const { 
  checkAuthorization, 
  getAllUsers, 
  updateUser, 
  addUser, 
  deleteUser,
  getPendingRequests 
} = require('../shared/auth');

module.exports = async function (context, req) {
  context.log('Users API called:', req.method, req.url);

  try {
    // Check if user is authenticated and is an Admin
    const authResult = await checkAuthorization(context, 'Admin');
    
    if (!authResult.authorized) {
      context.res = {
        status: 403,
        body: {
          success: false,
          error: authResult.error || 'Admin access required',
          userStatus: authResult.user?.Status,
          userRole: authResult.user?.Role
        }
      };
      return;
    }

    const adminEmail = authResult.user.Email;

    // GET - List all users or pending requests
    if (req.method === 'GET') {
      const { pending } = req.query;
      
      if (pending === 'true') {
        const requests = await getPendingRequests();
        context.res = {
          status: 200,
          body: {
            success: true,
            requests
          }
        };
      } else {
        const users = await getAllUsers();
        context.res = {
          status: 200,
          body: {
            success: true,
            users
          }
        };
      }
      return;
    }

    // POST - Add new user
    if (req.method === 'POST') {
      const { email, role, status, notes } = req.body;

      if (!email || !role) {
        context.res = {
          status: 400,
          body: {
            success: false,
            error: 'Email and role are required'
          }
        };
        return;
      }

      // Validate role
      if (!['Admin', 'Full', 'Read'].includes(role)) {
        context.res = {
          status: 400,
          body: {
            success: false,
            error: 'Invalid role. Must be Admin, Full, or Read'
          }
        };
        return;
      }

      await addUser(
        email, 
        role, 
        status || 'Active', 
        notes || `Added by ${adminEmail}`,
        adminEmail
      );

      context.res = {
        status: 201,
        body: {
          success: true,
          message: 'User added successfully'
        }
      };
      return;
    }

    // PUT - Update user
    if (req.method === 'PUT') {
      const { id, role, status, notes } = req.body;

      if (!id) {
        context.res = {
          status: 400,
          body: {
            success: false,
            error: 'User ID is required'
          }
        };
        return;
      }

      // Validate role if provided
      if (role && !['Admin', 'Full', 'Read'].includes(role)) {
        context.res = {
          status: 400,
          body: {
            success: false,
            error: 'Invalid role. Must be Admin, Full, or Read'
          }
        };
        return;
      }

      // Validate status if provided
      if (status && !['Active', 'Pending', 'Denied', 'Suspended'].includes(status)) {
        context.res = {
          status: 400,
          body: {
            success: false,
            error: 'Invalid status'
          }
        };
        return;
      }

      await updateUser(id, { role, status, notes }, adminEmail);

      context.res = {
        status: 200,
        body: {
          success: true,
          message: 'User updated successfully'
        }
      };
      return;
    }

    // DELETE - Remove user
    if (req.method === 'DELETE') {
      const { id } = req.body;

      if (!id) {
        context.res = {
          status: 400,
          body: {
            success: false,
            error: 'User ID is required'
          }
        };
        return;
      }

      await deleteUser(id);

      context.res = {
        status: 200,
        body: {
          success: true,
          message: 'User deleted successfully'
        }
      };
      return;
    }

    // Method not allowed
    context.res = {
      status: 405,
      body: {
        success: false,
        error: 'Method not allowed'
      }
    };

  } catch (error) {
    context.log.error('Error in users API:', error);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: error.message || 'Internal server error'
      }
    };
  }
};
