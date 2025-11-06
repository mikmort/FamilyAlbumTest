const { query } = require('../api/shared/db');

async function checkPendingUsers() {
    try {
        console.log('Checking for pending users...\n');
        
        // Get all pending users
        const pendingUsers = await query(`
            SELECT ID, Email, Role, Status, RequestedAt, Notes
            FROM dbo.Users
            WHERE Status = 'Pending'
            ORDER BY RequestedAt DESC
        `);
        
        console.log(`Found ${pendingUsers.length} pending user(s):\n`);
        
        if (pendingUsers.length > 0) {
            pendingUsers.forEach(user => {
                console.log(`ID: ${user.ID}`);
                console.log(`Email: ${user.Email}`);
                console.log(`Status: ${user.Status}`);
                console.log(`Requested: ${user.RequestedAt}`);
                console.log(`Notes: ${user.Notes || 'None'}`);
                console.log('---');
            });
        } else {
            console.log('No pending users found.');
        }
        
        // Get all admin users who should receive notifications
        console.log('\nChecking admin users who receive notifications...\n');
        const admins = await query(`
            SELECT Email, Role, Status
            FROM dbo.Users
            WHERE Role = 'Admin' AND Status = 'Active'
        `);
        
        console.log(`Found ${admins.length} active admin(s):`);
        admins.forEach(admin => {
            console.log(`- ${admin.Email} (${admin.Role})`);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
    
    process.exit(0);
}

checkPendingUsers();
