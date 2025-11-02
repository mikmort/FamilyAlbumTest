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

async function checkNamePhotoEvents() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        console.log('Connected to Azure SQL Database');

        // Query 1: Check for events in NamePhoto that are not in PPeopleList
        console.log('\n=== Query 1: Events in NamePhoto (neType=E) ===');
        const eventResult = await pool.request()
            .query(`
                SELECT 
                    np.npID,
                    np.npFileName,
                    ne.neName,
                    ne.neType,
                    COUNT(*) OVER (PARTITION BY np.npID) as event_file_count
                FROM dbo.NamePhoto np
                INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                WHERE ne.neType = 'E'
                ORDER BY np.npID, np.npFileName
            `);
        
        console.log(`Found ${eventResult.recordset.length} NamePhoto records for events`);
        if (eventResult.recordset.length > 0) {
            eventResult.recordset.slice(0, 20).forEach(row => {
                console.log(`  npID: ${row.npID}, File: ${row.npFileName}, Event: ${row.neName}, Type: ${row.neType}, FileCount: ${row.event_file_count}`);
            });
            if (eventResult.recordset.length > 20) {
                console.log(`  ... and ${eventResult.recordset.length - 20} more records`);
            }
        }

        // Query 2: Check DSC04780 specifically
        console.log('\n=== Query 2: DSC04780 NamePhoto records ===');
        const dsc04780Result = await pool.request()
            .query(`
                SELECT 
                    np.npID,
                    ne.neName,
                    ne.neType,
                    p.PPeopleList
                FROM dbo.NamePhoto np
                INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                LEFT JOIN dbo.Pictures p ON np.npFileName = p.PFileName
                WHERE np.npFileName = 'DSC04780.JPG'
                ORDER BY np.npID
            `);
        
        console.log(`Found ${dsc04780Result.recordset.length} NamePhoto records for DSC04780.JPG`);
        dsc04780Result.recordset.forEach(row => {
            console.log(`  npID: ${row.npID}, Name: ${row.neName}, Type: ${row.neType}, PPeopleList: ${row.PPeopleList}`);
        });

        // Query 3: Compare PPeopleList vs NamePhoto for DSC04780
        console.log('\n=== Query 3: Compare PPeopleList vs NamePhoto for DSC04780 ===');
        const compareResult = await pool.request()
            .query(`
                SELECT 
                    'PPeopleList' as source,
                    p.PFileName,
                    p.PPeopleList,
                    (SELECT COUNT(DISTINCT npID) FROM dbo.NamePhoto WHERE npFileName = p.PFileName) as namephoto_count
                FROM dbo.Pictures p
                WHERE p.PFileName = 'DSC04780.JPG'
                
                UNION ALL
                
                SELECT 
                    'NamePhoto' as source,
                    np.npFileName,
                    STRING_AGG(CAST(np.npID AS NVARCHAR(10)), ', ') as ids,
                    COUNT(*) as count
                FROM dbo.NamePhoto np
                WHERE np.npFileName = 'DSC04780.JPG'
                GROUP BY np.npFileName
            `);
        
        console.log('\nComparison:');
        compareResult.recordset.forEach(row => {
            console.log(`  Source: ${row.source}`);
            console.log(`    File: ${row.PFileName || row.npFileName}`);
            console.log(`    Data: ${row.PPeopleList || row.ids}`);
            console.log(`    Count: ${row.namephoto_count || row.count}`);
        });

        // Query 4: Statistics - how many files have events in NamePhoto
        console.log('\n=== Query 4: Statistics ===');
        const statsResult = await pool.request()
            .query(`
                SELECT 
                    COUNT(DISTINCT np.npFileName) as files_with_events,
                    COUNT(DISTINCT np.npID) as unique_events,
                    COUNT(*) as total_namephoto_event_records
                FROM dbo.NamePhoto np
                INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                WHERE ne.neType = 'E'
            `);
        
        const stats = statsResult.recordset[0];
        console.log(`  Files with events: ${stats.files_with_events}`);
        console.log(`  Unique events: ${stats.unique_events}`);
        console.log(`  Total NamePhoto event records: ${stats.total_namephoto_event_records}`);

        // Query 5: Find events that are in NamePhoto but NOT in PPeopleList for their files
        console.log('\n=== Query 5: Events in NamePhoto but not in PPeopleList ===');
        const orphanResult = await pool.request()
            .query(`
                SELECT 
                    np.npID,
                    ne.neName,
                    np.npFileName,
                    p.PPeopleList,
                    COUNT(*) OVER (PARTITION BY ne.ID) as total_files_for_event
                FROM dbo.NamePhoto np
                INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                INNER JOIN dbo.Pictures p ON np.npFileName = p.PFileName
                WHERE ne.neType = 'E'
                AND (p.PPeopleList IS NULL 
                     OR p.PPeopleList = ''
                     OR p.PPeopleList NOT LIKE '%' + CAST(np.npID AS NVARCHAR(10)) + '%')
                ORDER BY np.npID, np.npFileName
            `);
        
        console.log(`Found ${orphanResult.recordset.length} records where events are in NamePhoto but NOT in PPeopleList`);
        if (orphanResult.recordset.length > 0) {
            orphanResult.recordset.slice(0, 20).forEach(row => {
                console.log(`  npID: ${row.npID}, Event: ${row.neName}, File: ${row.npFileName}`);
                console.log(`    PPeopleList: ${row.PPeopleList || '(null)'}, Total files for this event: ${row.total_files_for_event}`);
            });
            if (orphanResult.recordset.length > 20) {
                console.log(`  ... and ${orphanResult.recordset.length - 20} more records`);
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

checkNamePhotoEvents();
