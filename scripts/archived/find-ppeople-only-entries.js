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

async function findPPeopleOnlyEntries() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        console.log('=== Finding the 2 entries in PPeopleList that are NOT in NamePhoto ===\n');
        
        // The key insight: Get ALL pictures with PPeopleList, then check NamePhoto for each
        const results = await pool.request()
            .query(`
                SELECT DISTINCT
                    p.PFileName,
                    p.PPeopleList,
                    (SELECT STRING_AGG(CAST(np.npID AS VARCHAR(10)), ',')
                     FROM dbo.NamePhoto np
                     INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                     WHERE np.npFileName = p.PFileName
                     AND ne.neType = 'N') as NamePhotoList
                FROM dbo.Pictures p
                WHERE p.PPeopleList IS NOT NULL
                ORDER BY p.PFileName
            `);
        
        // Find the specific case: entries in PPeopleList with NO corresponding NamePhoto entries
        console.log('Looking for PPeopleList entries with NO corresponding NamePhoto person entries...\n');
        
        const ppeoplOnlyList = [];
        
        results.recordset.forEach(row => {
            // If NamePhotoList is null/empty but PPeopleList has content
            if ((!row.NamePhotoList || row.NamePhotoList.trim() === '') && row.PPeopleList) {
                ppeoplOnlyList.push({
                    fileName: row.PFileName,
                    ppeople: row.PPeopleList,
                    namephoto: row.NamePhotoList || '(none)'
                });
            }
        });
        
        console.log(`Found ${ppeoplOnlyList.length} files where PPeopleList has entries but NamePhoto has NO person entries\n`);
        
        // Get the first 5 to show
        console.log('First 5 examples:\n');
        ppeoplOnlyList.slice(0, 5).forEach((item, idx) => {
            console.log(`${idx + 1}. ${item.fileName}`);
            console.log(`   PPeopleList: ${item.ppeople}`);
            console.log(`   NamePhoto: ${item.namephoto}\n`);
        });
        
        // Now specifically look for entries in SPECIFIC PPeopleList IDs
        console.log('\n=== Alternative analysis: Check which PPeopleList IDs are missing from NamePhoto ===\n');
        
        // Get a sample query
        const sampleResults = await pool.request()
            .query(`
                SELECT TOP 100
                    p.PFileName,
                    p.PPeopleList,
                    (SELECT STRING_AGG(CAST(np.npID AS VARCHAR(10)), ',')
                     FROM dbo.NamePhoto np
                     WHERE np.npFileName = p.PFileName) as AllNamePhotoIDs
                FROM dbo.Pictures p
                WHERE p.PPeopleList IS NOT NULL
                AND LEN(p.PPeopleList) > 0
                ORDER BY CAST(LEN(p.PPeopleList) - LEN(REPLACE(p.PPeopleList, ',', '')) as INT) ASC
            `);
        
        console.log('Analyzing samples to find which specific PPeopleList IDs are missing...\n');
        
        const missingIds = new Set();
        
        sampleResults.recordset.forEach(row => {
            if (!row.PPeopleList) return;
            
            const ppeoplIds = row.PPeopleList.split(',').map(s => s.trim());
            const namephotoIds = row.AllNamePhotoIDs ? row.AllNamePhotoIDs.split(',').map(s => s.trim()) : [];
            
            ppeoplIds.forEach(id => {
                if (id && !namephotoIds.includes(id)) {
                    missingIds.add(parseInt(id));
                }
            });
        });
        
        console.log(`Missing IDs found: ${Array.from(missingIds).sort((a, b) => a - b).join(', ')}\n`);
        
        // Get the names of these IDs
        if (missingIds.size > 0) {
            const idArray = Array.from(missingIds).sort((a, b) => a - b);
            console.log('Names of people with PPeopleList entries but no NamePhoto entries:\n');
            
            for (const id of idArray.slice(0, 5)) {
                const nameResult = await pool.request()
                    .query(`
                        SELECT TOP 1 neName, neType
                        FROM dbo.NameEvent
                        WHERE ID = ${id}
                    `);
                
                if (nameResult.recordset.length > 0) {
                    const row = nameResult.recordset[0];
                    console.log(`ID ${id}: ${row.neName} (Type: ${row.neType === 'N' ? 'Person' : 'Event'})`);
                }
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

findPPeopleOnlyEntries();
