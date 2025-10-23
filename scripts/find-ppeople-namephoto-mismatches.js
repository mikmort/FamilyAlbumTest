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

async function findMismatchedEntries() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        console.log('=== Finding PPeopleList entries NOT in NamePhoto ===\n');
        
        // Find photos with PPeopleList entries that don't match NamePhoto
        console.log('Method: String matching on PPeopleList vs NamePhoto lookups\n');
        
        // Get all pictures and their people/events
        const results = await pool.request()
            .query(`
                SELECT DISTINCT
                    p.PFileName,
                    p.PPeopleList,
                    (SELECT STRING_AGG(CAST(np.npID AS VARCHAR(10)), ',')
                     FROM dbo.NamePhoto np
                     INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                     WHERE np.npFileName = p.PFileName
                     AND ne.neType = 'N') as NamePhotoList,
                    (SELECT COUNT(DISTINCT npID)
                     FROM dbo.NamePhoto np
                     WHERE np.npFileName = p.PFileName) as NamePhotoCount,
                    (SELECT COUNT(DISTINCT npID)
                     FROM dbo.NamePhoto np
                     INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                     WHERE np.npFileName = p.PFileName
                     AND ne.neType = 'N') as NamePhotoPeopleCount
                FROM dbo.Pictures p
                ORDER BY p.PFileName
            `);
        
        console.log(`Total pictures: ${results.recordset.length}\n`);
        
        // Find mismatches
        const mismatches = [];
        
        results.recordset.forEach(row => {
            const ppeoplSet = new Set();
            const namephotoSet = new Set();
            
            // Parse PPeopleList
            if (row.PPeopleList) {
                row.PPeopleList.split(',').forEach(id => {
                    const trimmed = id.trim();
                    if (trimmed) ppeoplSet.add(parseInt(trimmed));
                });
            }
            
            // Parse NamePhotoList
            if (row.NamePhotoList) {
                row.NamePhotoList.split(',').forEach(id => {
                    const trimmed = id.trim();
                    if (trimmed) namephotoSet.add(parseInt(trimmed));
                });
            }
            
            // Find differences
            const inPpeoplButNotNamephoto = [];
            const inNamephotoButNotPpeopl = [];
            
            ppeoplSet.forEach(id => {
                if (!namephotoSet.has(id)) {
                    inPpeoplButNotNamephoto.push(id);
                }
            });
            
            namephotoSet.forEach(id => {
                if (!ppeoplSet.has(id)) {
                    inNamephotoButNotPpeopl.push(id);
                }
            });
            
            if (inPpeoplButNotNamephoto.length > 0 || inNamephotoButNotPpeopl.length > 0) {
                mismatches.push({
                    fileName: row.PFileName,
                    ppeopleList: row.PPeopleList,
                    namephotoList: row.NamePhotoList,
                    inPpeoplButNotNamephoto,
                    inNamephotoButNotPpeopl,
                    ppeoplCount: ppeoplSet.size,
                    namephotoCount: namephotoSet.size
                });
            }
        });
        
        console.log(`Total mismatches found: ${mismatches.length}\n`);
        
        // Show the specific case: PPeopleList has entries NOT in NamePhoto
        console.log('=== CASE 1: Entries in PPeopleList but NOT in NamePhoto ===\n');
        const case1 = mismatches.filter(m => m.inPpeoplButNotNamephoto.length > 0);
        console.log(`Count: ${case1.length}\n`);
        
        case1.forEach((m, idx) => {
            console.log(`${idx + 1}. File: ${m.fileName}`);
            console.log(`   PPeopleList: ${m.ppeopleList}`);
            console.log(`   NamePhoto (people only): ${m.namephotoList || '(none)'}`);
            console.log(`   IDs in PPeopleList but NOT in NamePhoto: ${m.inPpeoplButNotNamephoto.join(', ')}`);
            console.log();
        });
        
        // Check what these IDs are (get their names)
        if (case1.length > 0) {
            console.log('=== Identifying the mismatched person IDs ===\n');
            
            const allMismatchedIds = [...new Set(case1.flatMap(m => m.inPpeoplButNotNamephoto))];
            console.log(`Mismatched IDs: ${allMismatchedIds.join(', ')}\n`);
            
            if (allMismatchedIds.length > 0) {
                const names = await pool.request()
                    .query(`
                        SELECT ID, neName, neType
                        FROM dbo.NameEvent
                        WHERE ID IN (${allMismatchedIds.map((_, i) => `@id${i}`).join(',')})
                    `.replace(/@id\d+/g, (match, offset) => `@id${offset}`));
                
                // Better approach - use string concatenation
                const idList = allMismatchedIds.join(',');
                const nameResult = await pool.request()
                    .query(`
                        SELECT ID, neName, neType
                        FROM dbo.NameEvent
                        WHERE ID IN (${idList})
                    `);
                
                console.log('Mismatched person/event details:');
                nameResult.recordset.forEach(row => {
                    console.log(`  ID ${row.ID}: ${row.neName} (Type: ${row.neType === 'N' ? 'Person' : 'Event'})`);
                });
            }
        }
        
        // Show the other case
        console.log('\n=== CASE 2: Entries in NamePhoto but NOT in PPeopleList ===\n');
        const case2 = mismatches.filter(m => m.inNamephotoButNotPpeopl.length > 0);
        console.log(`Count: ${case2.length}\n`);
        
        case2.slice(0, 10).forEach((m, idx) => {
            console.log(`${idx + 1}. File: ${m.fileName}`);
            console.log(`   PPeopleList: ${m.ppeopleList || '(none)'}`);
            console.log(`   NamePhoto (people only): ${m.namephotoList}`);
            console.log(`   IDs in NamePhoto but NOT in PPeopleList: ${m.inNamephotoButNotPpeopl.join(', ')}`);
            console.log();
        });
        
        if (case2.length > 10) {
            console.log(`... and ${case2.length - 10} more files with NamePhoto entries not in PPeopleList\n`);
        }

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

findMismatchedEntries();
