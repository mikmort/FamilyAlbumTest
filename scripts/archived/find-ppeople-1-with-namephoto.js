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

async function findPPeopleList1WithNamePhoto() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        
        console.log('=== Finding photos where PPeopleList="1" but they HAVE NamePhoto person entries ===\n');
        console.log('(These are the inconsistencies - photos marked as "no people" but have actual people tagged)\n');
        
        const results = await pool.request()
            .query(`
                SELECT 
                    p.PFileName,
                    p.PPeopleList,
                    COUNT(DISTINCT np.npID) as NamePhotoCount
                FROM dbo.Pictures p
                LEFT JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName
                LEFT JOIN dbo.NameEvent ne ON np.npID = ne.ID AND ne.neType = 'N'
                WHERE p.PPeopleList = '1'
                AND np.npID IS NOT NULL
                AND ne.neType = 'N'
                GROUP BY p.PFileName, p.PPeopleList
                ORDER BY p.PFileName
            `);
        
        console.log(`Found ${results.recordset.length} photos with PPeopleList="1" that have NamePhoto person entries\n`);
        
        if (results.recordset.length > 0) {
            console.log('The 2 (or more) problematic entries:\n');
            
            results.recordset.slice(0, 10).forEach((row, idx) => {
                console.log(`${idx + 1}. FILE: ${row.PFileName}`);
                console.log(`   PPeopleList: "${row.PPeopleList}" (should mean NO PEOPLE)`);
                console.log(`   BUT has ${row.NamePhotoCount} NamePhoto person entries`);
                console.log();
            });
            
            if (results.recordset.length > 10) {
                console.log(`... and ${results.recordset.length - 10} more\n`);
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

findPPeopleList1WithNamePhoto();
