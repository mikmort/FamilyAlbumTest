const { query } = require('../api/shared/db');

async function checkRecentActivity() {
    try {
        console.log('=== Checking Recent User Activity ===\n');
        
        // Get all users from the last hour
        const recentUsers = await query(`
            SELECT TOP 10 
                ID, Email, Role, Status, 
                RequestedAt, 
                DATEDIFF(MINUTE, RequestedAt, GETDATE()) as MinutesAgo
            FROM dbo.Users
            ORDER BY RequestedAt DESC
        `);
        
        console.log(`Recent users (last ${recentUsers.length}):\n`);
        recentUsers.forEach(user => {
            console.log(`ID: ${user.ID}`);
            console.log(`Email: ${user.Email}`);
            console.log(`Status: ${user.Status}`);
            console.log(`Role: ${user.Role}`);
            console.log(`Requested: ${user.MinutesAgo} minutes ago`);
            console.log('---');
        });
        
        // Check for approval tokens
        const tokens = await query(`
            SELECT TOP 5
                t.ID, t.Token, t.Action, t.UserID, u.Email,
                DATEDIFF(MINUTE, t.CreatedAt, GETDATE()) as MinutesAgo,
                t.UsedAt
            FROM dbo.ApprovalTokens t
            INNER JOIN dbo.Users u ON t.UserID = u.ID
            ORDER BY t.CreatedAt DESC
        `);
        
        console.log(`\nRecent approval tokens (${tokens.length}):\n`);
        tokens.forEach(token => {
            console.log(`User: ${token.Email}`);
            console.log(`Action: ${token.Action}`);
            console.log(`Created: ${token.MinutesAgo} minutes ago`);
            console.log(`Used: ${token.UsedAt ? 'Yes' : 'No'}`);
            console.log('---');
        });
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
    
    process.exit(0);
}

checkRecentActivity();
