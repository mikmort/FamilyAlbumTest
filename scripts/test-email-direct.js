const { EmailClient } = require('@azure/communication-email');

async function testDirectEmail() {
    const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
    const fromAddress = process.env.EMAIL_FROM_ADDRESS;
    
    console.log('\n📧 Testing Direct Email Send');
    console.log('========================================');
    console.log(`From: ${fromAddress}`);
    console.log(`To: mikmort@hotmail.com`);
    
    const emailClient = new EmailClient(connectionString);
    
    const message = {
        senderAddress: fromAddress,
        recipients: {
            to: [{ address: 'mikmort@hotmail.com' }]
        },
        content: {
            subject: 'Test Email from Family Album',
            html: '<h1>Test Email</h1><p>This is a test email from the Family Album application.</p>'
        }
    };
    
    try {
        console.log('\n📤 Sending email...');
        const poller = await emailClient.beginSend(message);
        console.log(`✅ Email submitted. Message ID: ${poller.getOperationState().id}`);
        
        console.log('\n⏳ Waiting for delivery status...');
        const result = await poller.pollUntilDone();
        
        console.log('\n📬 Final Result:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.status === 'Succeeded') {
            console.log('\n✅ EMAIL SENT SUCCESSFULLY!');
            console.log('Check mikmort@hotmail.com inbox (might be in spam folder)');
        } else {
            console.log('\n❌ EMAIL FAILED');
            console.log('Status:', result.status);
            console.log('Error:', result.error);
        }
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.code) console.error('Error Code:', error.code);
        if (error.statusCode) console.error('Status Code:', error.statusCode);
        if (error.body) console.error('Body:', error.body);
    }
}

testDirectEmail().catch(console.error);
