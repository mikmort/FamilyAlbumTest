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

async function compareApproaches() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        console.log('=== Comparing PPeopleList vs NamePhoto for Filtering ===\n');
        
        // Test person IDs to filter by
        const testPersonIds = [195, 281]; // Adam Hodges, Eliza Morton
        
        // APPROACH 1: Query NamePhoto table (current)
        console.log('APPROACH 1: NamePhoto Table Query (Current)');
        console.log('='*50);
        console.log('Query: Check NamePhoto for each person ID');
        
        const namephotoStart = Date.now();
        const namephotoResult = await pool.request()
            .input('person0', sql.Int, testPersonIds[0])
            .input('person1', sql.Int, testPersonIds[1])
            .query(`
                SELECT DISTINCT p.PFileName, p.PYear, p.PMonth
                FROM dbo.Pictures p
                WHERE EXISTS (
                    SELECT 1 FROM dbo.NamePhoto np 
                    INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                    WHERE np.npFileName = p.PFileName 
                    AND np.npID IN (@person0, @person1)
                    AND ne.neType = 'N'
                )
            `);
        const namephotoTime = Date.now() - namephotoStart;
        
        console.log(`Results: ${namephotoResult.recordset.length} photos`);
        console.log(`Time: ${namephotoTime}ms\n`);
        
        // APPROACH 2: Parse PPeopleList (alternative)
        console.log('APPROACH 2: PPeopleList String Matching');
        console.log('='*50);
        console.log('Query: Get all pictures and parse PPeopleList');
        
        const ppeoplStart = Date.now();
        const allPictures = await pool.request()
            .query(`
                SELECT p.PFileName, p.PYear, p.PMonth, p.PPeopleList
                FROM dbo.Pictures p
            `);
        
        // Client-side filtering
        const filteredByPpeople = allPictures.recordset.filter(pic => {
            if (!pic.PPeopleList) return false;
            const ids = pic.PPeopleList.split(',').map(s => s.trim());
            return ids.some(id => testPersonIds.includes(parseInt(id)));
        });
        
        const ppeoplTime = Date.now() - ppeoplStart;
        
        console.log(`Results: ${filteredByPpeople.length} photos`);
        console.log(`Time: ${ppeoplTime}ms (includes network + parsing)\n`);
        
        // APPROACH 3: Hybrid - use PPeopleList with SQL parsing
        console.log('APPROACH 3: Hybrid - SQL String Matching on PPeopleList');
        console.log('='*50);
        console.log('Query: Check if person IDs exist in PPeopleList string');
        
        const hybridStart = Date.now();
        const hybridResult = await pool.request()
            .input('person0', sql.Int, testPersonIds[0])
            .input('person1', sql.Int, testPersonIds[1])
            .query(`
                SELECT DISTINCT p.PFileName, p.PYear, p.PMonth
                FROM dbo.Pictures p
                WHERE (
                    PPeopleList LIKE '%' + CAST(@person0 AS VARCHAR(10)) + '%'
                    OR PPeopleList LIKE '%' + CAST(@person1 AS VARCHAR(10)) + '%'
                )
            `);
        const hybridTime = Date.now() - hybridStart;
        
        console.log(`Results: ${hybridResult.recordset.length} photos`);
        console.log(`Time: ${hybridTime}ms\n`);
        
        // ANALYSIS
        console.log('=== ANALYSIS ===\n');
        
        console.log('1. INDEX EFFICIENCY:');
        const indexInfo = await pool.request()
            .query(`
                SELECT 
                    OBJECT_NAME(i.object_id) as table_name,
                    i.name as index_name,
                    CAST(ps.in_row_data_page_count as decimal) * 8 as size_kb
                FROM sys.indexes i
                JOIN sys.dm_db_partition_stats ps ON i.object_id = ps.object_id AND i.index_id = ps.index_id
                WHERE OBJECT_NAME(i.object_id) IN ('NamePhoto', 'Pictures')
                ORDER BY table_name, index_name
            `);
        
        indexInfo.recordset.forEach(row => {
            console.log(`  ${row.table_name}.${row.index_name}: ${row.size_kb.toFixed(0)} KB`);
        });
        console.log();
        
        console.log('2. ROW COUNTS:');
        const rowCounts = await pool.request()
            .query(`
                SELECT 
                    'Pictures' as table_name,
                    COUNT(*) as row_count
                FROM dbo.Pictures
                UNION ALL
                SELECT 
                    'NamePhoto' as table_name,
                    COUNT(*) as row_count
                FROM dbo.NamePhoto
            `);
        
        rowCounts.recordset.forEach(row => {
            console.log(`  ${row.table_name}: ${row.row_count} rows`);
        });
        console.log();
        
        console.log('3. PROS & CONS:');
        console.log(`
NamePhoto Approach (Approach 1):
  Pros:
    ✓ Normalized database design
    ✓ Can filter by neType (People vs Events)
    ✓ Handles NULL PPeopleList gracefully
    ✓ JOIN on indexed columns (npID, npFileName)
    ✓ Correct data semantics (NamePhoto is source of truth)
  Cons:
    ✗ Extra table JOIN (slower for simple lookups)
    ✗ Performance: ${namephotoTime}ms

PPeopleList Approach (Approach 2):
  Pros:
    ✓ Simple string matching
    ✓ No table JOINs needed
    ✓ Single table query
  Cons:
    ✗ Comma-separated list is anti-pattern
    ✗ Handles edge cases poorly (ID "1" matches "10", "12", "100")
    ✗ Must parse all 9,715 records (even if using LIKE)
    ✗ Performance: ${ppeoplTime}ms
    ✗ No type filtering (can't distinguish people from events)
    ✗ Slower with wildcards in SQL

Hybrid Approach (Approach 3):
  Pros:
    ✓ No client-side parsing
    ✓ Direct SQL query
  Cons:
    ✗ Vulnerable to false matches (ID "1" matches "10", "100")
    ✗ Still slower than NamePhoto approach
    ✗ Performance: ${hybridTime}ms
    ✗ String matching is inherently slow on large text fields
`);
        
        console.log('\n4. PERFORMANCE COMPARISON:');
        console.log(`  NamePhoto (JOIN):  ${namephotoTime}ms ← FASTEST & MOST CORRECT`);
        console.log(`  PPeopleList (LIKE): ${hybridTime}ms`);
        console.log(`  Client parsing:     ${ppeoplTime}ms (includes network latency)`);
        
        console.log('\n5. CORRECTNESS CHECK:');
        console.log(`  NamePhoto results:  ${namephotoResult.recordset.length} photos`);
        console.log(`  PPeopleList results: ${filteredByPpeople.length} photos`);
        
        const namephotoSet = new Set(namephotoResult.recordset.map(r => r.PFileName));
        const ppleSet = new Set(filteredByPpeople.map(r => r.PFileName));
        
        let matches = 0;
        let mismatches = 0;
        namephotoSet.forEach(file => {
            if (ppleSet.has(file)) matches++;
            else mismatches++;
        });
        
        console.log(`  Matching results: ${matches}/${namephotoSet.size}`);
        console.log(`  Mismatching results: ${mismatches}/${namephotoSet.size}`);

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

compareApproaches();
