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

async function findInconsistencies() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        
        console.log('=== Analysis: PPeopleList vs NamePhoto Consistency ===\n');
        
        // Count photos with PPeopleList="1" (should have NO NamePhoto)
        const result1 = await pool.request()
            .query(`
                SELECT COUNT(*) as PeopleList1_NoNamePhoto
                FROM dbo.Pictures p
                WHERE p.PPeopleList = '1'
                AND NOT EXISTS (
                    SELECT 1 
                    FROM dbo.NamePhoto np
                    INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID AND ne.neType = 'N'
                    WHERE np.npFileName = p.PFileName
                )
            `);
        
        // Count photos with PPeopleList="1" that DO have NamePhoto
        const result2 = await pool.request()
            .query(`
                SELECT COUNT(*) as PeopleList1_WithNamePhoto
                FROM dbo.Pictures p
                WHERE p.PPeopleList = '1'
                AND EXISTS (
                    SELECT 1 
                    FROM dbo.NamePhoto np
                    INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID AND ne.neType = 'N'
                    WHERE np.npFileName = p.PFileName
                )
            `);
        
        // Count photos with NamePhoto but PPeopleList doesn't include those IDs
        const result3 = await pool.request()
            .query(`
                SELECT TOP 5
                    p.PFileName,
                    p.PPeopleList,
                    STRING_AGG(CAST(np.npID AS VARCHAR(10)), ',') as NamePhotoIDs
                FROM dbo.Pictures p
                INNER JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName
                INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID AND ne.neType = 'N'
                WHERE p.PPeopleList IS NOT NULL
                AND p.PPeopleList != '1'
                -- Check if this NamePhoto ID is NOT in PPeopleList
                AND CAST(np.npID AS VARCHAR(10)) NOT IN (
                    SELECT value FROM STRING_SPLIT(p.PPeopleList, ',')
                )
                GROUP BY p.PFileName, p.PPeopleList
                ORDER BY p.PFileName
            `);
        
        console.log(`Photos with PPeopleList="1" (no people) and NO NamePhoto entries: ${result1.recordset[0].PeopleList1_NoNamePhoto}`);
        console.log(`Photos with PPeopleList="1" (no people) but HAVE NamePhoto entries: ${result2.recordset[0].PeopleList1_WithNamePhoto}`);
        console.log();
        
        console.log('Sample photos where NamePhoto IDs are NOT in PPeopleList:\n');
        result3.recordset.forEach((row, idx) => {
            console.log(`${idx + 1}. ${row.PFileName}`);
            console.log(`   PPeopleList: ${row.PPeopleList}`);
            console.log(`   NamePhoto IDs: ${row.NamePhotoIDs}`);
            console.log();
        });

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

findInconsistencies();
