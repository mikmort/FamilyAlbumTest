// Verify performance optimization indexes
const sql = require('mssql');
const readline = require('readline');

const server = 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net';
const database = 'FamilyAlbum';
const user = 'familyadmin';

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
    const password = await promptPassword();

    const config = {
        server, database, user, password,
        options: { encrypt: true, trustServerCertificate: false }
    };

    try {
        console.log('\n✓ Connecting to database...\n');
        const pool = await sql.connect(config);
        
        const result = await pool.request().query(`
            SELECT 
                OBJECT_NAME(object_id) AS TableName,
                name AS IndexName,
                type_desc AS IndexType
            FROM sys.indexes 
            WHERE name LIKE 'IX_%' 
                AND OBJECT_NAME(object_id) IN ('Pictures', 'NamePhoto', 'NameEvent', 'FaceEncodings', 'FaceEmbeddings')
            ORDER BY TableName, IndexName
        `);
        
        console.log('=== Database Indexes ===\n');
        console.table(result.recordset);
        
        await pool.close();
        
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

main();
