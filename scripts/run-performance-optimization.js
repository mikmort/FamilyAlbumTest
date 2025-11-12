// Run database performance optimization script
const fs = require('fs');
const sql = require('mssql');
const path = require('path');
const readline = require('readline');

// Get command line arguments
const args = process.argv.slice(2);
let server = args[0] || 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net';
let database = args[1] || 'FamilyAlbum';
let user = args[2] || 'familyadmin';
let password = args[3];

async function promptPassword() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Enter SQL password: ', (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function main() {
    if (!password) {
        password = await promptPassword();
    }

    const config = {
        server: server,
        database: database,
        user: user,
        password: password,
        options: {
            encrypt: true,
            trustServerCertificate: false,
            enableArithAbort: true,
        }
    };

    console.log('\nConfiguration:');
    console.log('  Server:', config.server);
    console.log('  Database:', config.database);
    console.log('  User:', config.user);
    console.log('');

    try {
        console.log('Connecting to database...');
        const pool = await sql.connect(config);
        
        console.log('Reading SQL script...');
        const sqlScript = fs.readFileSync(path.join(__dirname, '..', 'database', 'optimize-basic-tier-performance.sql'), 'utf8');
        
        // Split by GO statements and execute each batch
        const batches = sqlScript
            .split(/\r?\nGO\r?\n/gi)
            .map(b => b.trim())
            .filter(b => b.length > 0 && !b.startsWith('--'));
        
        console.log(`Executing ${batches.length} SQL batches...\n`);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            
            try {
                const result = await pool.request().query(batch);
                
                // Print any result sets
                if (result.recordset && result.recordset.length > 0) {
                    console.table(result.recordset);
                }
            } catch (err) {
                // Some batches are PRINT statements or DDL that don't return results
                if (!err.message.includes('No columns') && !err.message.includes('PRINT')) {
                    console.log(`  Note: ${err.message}`);
                }
            }
        }
        
        console.log('\n✓ Optimization complete!');
        await pool.close();
        
    } catch (err) {
        console.error('\nError:', err.message);
        process.exit(1);
    }
}

main();
