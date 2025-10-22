const sql = require('mssql');

const config = {
    server: process.env.AZURE_SQL_SERVER,
    authentication: {
        type: 'default',
        options: {
            userName: process.env.AZURE_SQL_USER,
            password: process.env.AZURE_SQL_PASSWORD
        }
    },
    options: {
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 15000
    },
    database: 'FamilyAlbum'
};

async function checkDSC04780Variants() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        
        // Find all DSC04780 variants
        console.log('=== All DSC04780 variants in Pictures ===');
        const picResult = await pool.request()
            .query(`
                SELECT PFileName, PPeopleList FROM dbo.Pictures 
                WHERE PFileName LIKE '%DSC04780%'
                ORDER BY PFileName
            `);
        
        console.log(`Found ${picResult.recordset.length} variants:`);
        picResult.recordset.forEach(row => {
            console.log(`  ${row.PFileName}`);
            console.log(`    PPeopleList: ${row.PPeopleList || '(null)'}`);
        });

        // Check NamePhoto for these files
        console.log('\n=== NamePhoto records for DSC04780 variants ===');
        const npResult = await pool.request()
            .query(`
                SELECT 
                    np.npID,
                    np.npFileName,
                    ne.neName,
                    ne.neType
                FROM dbo.NamePhoto np
                INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                WHERE np.npFileName LIKE '%DSC04780%'
                ORDER BY np.npFileName, np.npID
            `);
        
        console.log(`Found ${npResult.recordset.length} NamePhoto records:`);
        npResult.recordset.forEach(row => {
            console.log(`  File: ${row.npFileName}`);
            console.log(`    npID: ${row.npID}, Name: ${row.neName}, Type: ${row.neType}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.close();
    }
}

checkDSC04780Variants();
