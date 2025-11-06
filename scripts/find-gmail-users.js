const { query } = require('../api/shared/db');

query("SELECT * FROM dbo.Users WHERE Email LIKE '%gmail%'")
    .then(users => {
        console.log(`Found ${users.length} Gmail user(s):\n`);
        users.forEach(u => {
            console.log(`ID: ${u.ID}, Email: ${u.Email}, Status: ${u.Status}, Role: ${u.Role}`);
        });
        process.exit(0);
    })
    .catch(e => {
        console.error(e.message);
        process.exit(1);
    });
