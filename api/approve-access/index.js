const { query } = require('../shared/db');
const { getUserEmail } = require('../shared/auth');

module.exports = async function (context, req) {
    context.log('Approve access API called');

    try {
        const token = req.query.token;
        const action = req.query.action;
        const confirm = req.body?.confirm;

        if (!token) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    success: false,
                    error: 'Token is required' 
                }
            };
            return;
        }

        // GET - Show confirmation page with token details
        if (req.method === 'GET') {
            // Validate token and get user details
            const tokenData = await query(`
                SELECT 
                    t.ID as TokenID,
                    t.Token,
                    t.Action,
                    t.ExpiresAt,
                    t.UsedAt,
                    u.ID as UserID,
                    u.Email,
                    u.Status,
                    u.Role
                FROM dbo.ApprovalTokens t
                INNER JOIN dbo.Users u ON t.UserID = u.ID
                WHERE t.Token = @token
            `, { token });

            if (tokenData.length === 0) {
                context.res = {
                    status: 404,
                    headers: { 'Content-Type': 'text/html' },
                    body: generateHtmlPage({
                        title: 'Invalid Token',
                        icon: '❌',
                        message: 'This approval link is invalid or has been removed.',
                        details: 'The token may have been deleted or never existed.'
                    })
                };
                return;
            }

            const data = tokenData[0];

            // Check if already used
            if (data.UsedAt) {
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' },
                    body: generateHtmlPage({
                        title: 'Already Processed',
                        icon: '✅',
                        message: 'This approval link has already been used.',
                        details: `Action was processed on ${new Date(data.UsedAt).toLocaleString()}.`
                    })
                };
                return;
            }

            // Check if expired
            if (new Date(data.ExpiresAt) < new Date()) {
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' },
                    body: generateHtmlPage({
                        title: 'Link Expired',
                        icon: '⏰',
                        message: 'This approval link has expired.',
                        details: `This link expired on ${new Date(data.ExpiresAt).toLocaleString()}. Please contact an administrator.`
                    })
                };
                return;
            }

            // Show confirmation page
            const actionText = getActionText(data.Action);
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'text/html' },
                body: generateConfirmationPage({
                    email: data.Email,
                    action: data.Action,
                    actionText: actionText,
                    token: token
                })
            };
            return;
        }

        // POST - Process the approval/denial
        if (req.method === 'POST') {
            if (!confirm) {
                context.res = {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                    body: { 
                        success: false,
                        error: 'Confirmation required' 
                    }
                };
                return;
            }

            // Get admin email if authenticated
            const adminEmail = getUserEmail(context) || 'System';

            // Get token data with FOR UPDATE lock
            const tokenData = await query(`
                SELECT 
                    t.ID as TokenID,
                    t.Action,
                    t.ExpiresAt,
                    t.UsedAt,
                    u.ID as UserID,
                    u.Email,
                    u.Status
                FROM dbo.ApprovalTokens t
                INNER JOIN dbo.Users u ON t.UserID = u.ID
                WHERE t.Token = @token
            `, { token });

            if (tokenData.length === 0) {
                context.res = {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: { 
                        success: false,
                        error: 'Invalid token' 
                    }
                };
                return;
            }

            const data = tokenData[0];

            // Check if already used
            if (data.UsedAt) {
                context.res = {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' },
                    body: { 
                        success: false,
                        error: 'Token already used' 
                    }
                };
                return;
            }

            // Check if expired
            if (new Date(data.ExpiresAt) < new Date()) {
                context.res = {
                    status: 410,
                    headers: { 'Content-Type': 'application/json' },
                    body: { 
                        success: false,
                        error: 'Token expired' 
                    }
                };
                return;
            }

            // Determine the new role and status based on action
            let newRole, newStatus;
            switch (data.Action) {
                case 'FullAccess':
                    newRole = 'Full';
                    newStatus = 'Active';
                    break;
                case 'ReadOnly':
                    newRole = 'Read';
                    newStatus = 'Active';
                    break;
                case 'Deny':
                    // Keep existing role for denied users (they won't be able to access anyway)
                    newRole = data.Role;
                    newStatus = 'Denied';
                    break;
                default:
                    context.res = {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                        body: { 
                            success: false,
                            error: 'Invalid action' 
                        }
                    };
                    return;
            }

            // Update user status and role
            await query(`
                UPDATE dbo.Users 
                SET Role = @role,
                    Status = @status,
                    ApprovedAt = GETDATE(),
                    ApprovedBy = @adminEmail,
                    UpdatedAt = GETDATE()
                WHERE ID = @userId
            `, {
                userId: data.UserID,
                role: newRole,
                status: newStatus,
                adminEmail: adminEmail
            });

            // Mark token as used
            await query(`
                UPDATE dbo.ApprovalTokens
                SET UsedAt = GETDATE(),
                    UsedBy = @adminEmail
                WHERE ID = @tokenId
            `, {
                tokenId: data.TokenID,
                adminEmail: adminEmail
            });

            context.log(`Access ${data.Action} processed for user ${data.Email} by ${adminEmail}`);

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    success: true,
                    message: `User ${data.Email} has been ${newStatus === 'Active' ? 'approved' : 'denied'}`,
                    action: data.Action,
                    userEmail: data.Email,
                    newRole: newRole,
                    newStatus: newStatus
                }
            };
            return;
        }

        // Method not allowed
        context.res = {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
            body: {
                success: false,
                error: 'Method not allowed'
            }
        };

    } catch (error) {
        context.log.error('Error processing approval:', error);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                success: false,
                error: error.message || 'Internal server error'
            }
        };
    }
};

function getActionText(action) {
    switch (action) {
        case 'FullAccess':
            return 'Approve with Full Access';
        case 'ReadOnly':
            return 'Approve with Read-Only Access';
        case 'Deny':
            return 'Deny Access';
        default:
            return 'Unknown Action';
    }
}

function generateHtmlPage({ title, icon, message, details }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Family Album</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin: 0 0 15px 0;
            font-size: 28px;
        }
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 20px 0;
        }
        .details {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            color: #666;
            font-size: 14px;
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        ${details ? `<div class="details">${details}</div>` : ''}
    </div>
</body>
</html>`;
}

function generateConfirmationPage({ email, action, actionText, token }) {
    const actionColor = action === 'Deny' ? '#dc3545' : '#28a745';
    const actionIcon = action === 'Deny' ? '❌' : '✅';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm Action - Family Album</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin: 0 0 15px 0;
            font-size: 28px;
        }
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 20px 0;
        }
        .user-info {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .user-info strong {
            color: #333;
            font-size: 18px;
        }
        .action-info {
            margin: 20px 0;
            padding: 15px;
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 8px;
            color: #856404;
        }
        .buttons {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 20px;
        }
        button {
            padding: 14px 28px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        .btn-confirm {
            background: ${actionColor};
            color: white;
        }
        .btn-confirm:hover {
            opacity: 0.9;
            transform: translateY(-2px);
        }
        .btn-cancel {
            background: #6c757d;
            color: white;
        }
        .btn-cancel:hover {
            opacity: 0.9;
        }
        .loading {
            display: none;
            margin-top: 20px;
        }
        .success, .error {
            display: none;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">${actionIcon}</div>
        <h1>Confirm Action</h1>
        <p>You are about to take the following action:</p>
        
        <div class="user-info">
            <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">User Email</p>
            <strong>${email}</strong>
        </div>

        <div class="action-info">
            <strong>${actionText}</strong>
        </div>

        <p style="font-size: 14px; color: #999;">
            This action will update the user's permissions immediately.
        </p>

        <div class="buttons">
            <button class="btn-cancel" onclick="window.close()">Cancel</button>
            <button class="btn-confirm" onclick="confirmAction()">Confirm</button>
        </div>

        <div class="loading" id="loading">
            <p>Processing...</p>
        </div>

        <div class="success" id="success">
            <strong>✅ Success!</strong>
            <p style="margin: 10px 0 0 0;">The action has been completed successfully.</p>
        </div>

        <div class="error" id="error">
            <strong>❌ Error</strong>
            <p style="margin: 10px 0 0 0;" id="error-message"></p>
        </div>
    </div>

    <script>
        async function confirmAction() {
            const buttons = document.querySelector('.buttons');
            const loading = document.getElementById('loading');
            const success = document.getElementById('success');
            const error = document.getElementById('error');
            
            buttons.style.display = 'none';
            loading.style.display = 'block';

            try {
                const response = await fetch('/api/approve-access?token=${token}', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ confirm: true })
                });

                const result = await response.json();
                
                loading.style.display = 'none';
                
                if (result.success) {
                    success.style.display = 'block';
                    setTimeout(() => {
                        window.close();
                    }, 3000);
                } else {
                    error.style.display = 'block';
                    document.getElementById('error-message').textContent = result.error || 'Unknown error occurred';
                    setTimeout(() => {
                        buttons.style.display = 'flex';
                        error.style.display = 'none';
                    }, 5000);
                }
            } catch (err) {
                loading.style.display = 'none';
                error.style.display = 'block';
                document.getElementById('error-message').textContent = 'Failed to process request: ' + err.message;
                setTimeout(() => {
                    buttons.style.display = 'flex';
                    error.style.display = 'none';
                }, 5000);
            }
        }
    </script>
</body>
</html>`;
}
