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

async function findTwoSpecificMismatches() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        
        console.log('=== Finding photos that are ONLY in PPeopleList (no corresponding NamePhoto entry) ===\n');
        
        // More direct approach: find photos where PPeopleList has IDs that don't exist in NamePhoto at all
        const results = await pool.request()
            .query(`
                SELECT DISTINCT
                    p.PFileName,
                    p.PPeopleList,
                    (SELECT STRING_AGG(CAST(np.npID AS VARCHAR(10)), ',')
                     FROM dbo.NamePhoto np
                     WHERE np.npFileName = p.PFileName
                     AND np.npID NOT IN (SELECT ID FROM dbo.NameEvent WHERE neType = 'E')) as AllNamePhotoIDs
                FROM dbo.Pictures p
                WHERE p.PPeopleList IS NOT NULL AND LEN(p.PPeopleList) > 0
                ORDER BY p.PFileName
            `);
        
        const problematicPhotos = [];
        
        results.recordset.forEach(row => {
            const ppeoplIds = new Set(row.PPeopleList.split(',').map(s => parseInt(s.trim())));
            const namephotoIds = row.AllNamePhotoIDs ? 
                new Set(row.AllNamePhotoIDs.split(',').map(s => parseInt(s.trim()))) : 
                new Set();
            
            // Find IDs in PPeopleList but NOT in NamePhoto at all
            let hasOnlyInPpeopl = false;
            const onlyInPpeopl = [];
            
            ppeoplIds.forEach(id => {
                if (!namephotoIds.has(id)) {
                    onlyInPpeopl.push(id);
                    hasOnlyInPpeopl = true;
                }
            });
            
            if (hasOnlyInPpeopl && onlyInPpeopl.length > 0) {
                problematicPhotos.push({
                    fileName: row.PFileName,
                    ppeopleIds: Array.from(ppeoplIds).sort((a, b) => a - b),
                    namephotoIds: Array.from(namephotoIds).sort((a, b) => a - b),
                    onlyInPpeopl: onlyInPpeopl.sort((a, b) => a - b)
                });
            }
        });
        
        console.log(`Total photos with PPeopleList entries NOT in NamePhoto: ${problematicPhotos.length}\n`);
        
        // Show all of them if they're few, or top ones if many
        const toShow = problematicPhotos.length <= 10 ? problematicPhotos : problematicPhotos.slice(0, 20);
        
        console.log(`Showing ${toShow.length} entries:\n`);
        
        toShow.forEach((photo, idx) => {
            console.log(`${idx + 1}. ${photo.fileName}`);
            console.log(`   PPeopleList IDs: ${photo.ppeopleIds.join(', ')}`);
            console.log(`   NamePhoto IDs: ${photo.namephotoIds.length > 0 ? photo.namephotoIds.join(', ') : '(none)'}`);
            console.log(`   >>> IDs ONLY in PPeopleList: ${photo.onlyInPpeopl.join(', ')}`);
            console.log();
        });
        
        // Get the unique IDs that appear only in PPeopleList
        const uniqueOnlyIds = new Set();
        problematicPhotos.forEach(photo => {
            photo.onlyInPpeopl.forEach(id => uniqueOnlyIds.add(id));
        });
        
        console.log(`\n=== Unique PPeopleList IDs that have NO NamePhoto entries ===\n`);
        console.log(`IDs: ${Array.from(uniqueOnlyIds).sort((a, b) => a - b).join(', ')}\n`);
        
        // Get names
        const uniqueIdArray = Array.from(uniqueOnlyIds).sort((a, b) => a - b);
        if (uniqueIdArray.length > 0) {
            console.log('Details:\n');
            for (const id of uniqueIdArray) {
                const nameResult = await pool.request()
                    .query(`
                        SELECT neName, neType
                        FROM dbo.NameEvent
                        WHERE ID = ${id}
                    `);
                
                if (nameResult.recordset.length > 0) {
                    const row = nameResult.recordset[0];
                    const typeStr = row.neType === 'N' ? 'Person' : 'Event';
                    console.log(`ID ${id}: "${row.neName}" (Type: ${typeStr})`);
                }
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

findTwoSpecificMismatches();
