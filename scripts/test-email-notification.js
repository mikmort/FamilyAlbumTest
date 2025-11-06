const { execute, query } = require('../api/shared/db');

async function createTestUser() {
    try {
        console.log('Creating test pending user...\n');
        
        // First, delete if exists
        await execute(`DELETE FROM dbo.Users WHERE Email = 'mikmort@gmail.com'`);
        
        // Create new pending user
        const result = await query(`
            INSERT INTO dbo.Users (Email, Role, Status, RequestedAt)
            OUTPUT INSERTED.ID
            VALUES ('mikmort@gmail.com', 'Read', 'Pending', GETDATE())
        `);
        
        const userId = result[0].ID;
        console.log(`✅ Created user ID: ${userId}`);
        console.log(`Email: mikmort@gmail.com`);
        console.log(`Status: Pending`);
        console.log(`\nNow triggering email notification...\n`);
        
        // Trigger email notification
        const fetch = require('node-fetch');
        const response = await fetch('https://www.mortonfamilyalbum.com/api/notify-admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userEmail: 'mikmort@gmail.com',
                userName: 'Mike Morton',
                message: 'Manual test of email notification system'
            })
        });
        
        const data = await response.json();
        console.log('API Response:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.emailSent) {
            console.log('\n✅ Email was sent successfully!');
            console.log(`Method: ${data.emailMethod}`);
            console.log(`Admins notified: ${data.admins.join(', ')}`);
        } else {
            console.log('\n❌ Email was NOT sent');
            console.log(`Reason: ${data.message}`);
            if (data.approvalLinks) {
                console.log('\n📋 Manual approval links:');
                console.log(`Full Access: ${data.approvalLinks.fullAccess}`);
                console.log(`Read Only: ${data.approvalLinks.readOnly}`);
                console.log(`Deny: ${data.approvalLinks.deny}`);
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

createTestUser();
