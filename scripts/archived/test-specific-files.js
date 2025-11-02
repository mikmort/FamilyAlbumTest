const sql = require('mssql');

const config = {
    server: process.env.DB_SERVER || 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net',
    database: process.env.DB_NAME || 'familyalbum-prod-db',
    authentication: {
        type: 'default',
        options: {
            userName: process.env.DB_USER || 'sqladmin',
            password: process.env.DB_PASSWORD
        }
    },
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

async function testSpecificFiles() {
    try {
        console.log('Connecting to database...');
        const pool = await sql.connect(config);
        
        // Test 1: Check for .mov files
        console.log('\n=== Testing MOV files ===');
        const movQuery = `
            SELECT TOP 5
                PFileName, 
                PType,
                PBlobUrl,
                PThumbUrl,
                PWidth,
                PHeight,
                CASE 
                    WHEN PThumbUrl IS NULL THEN 'NO THUMBNAIL URL'
                    WHEN PThumbUrl = '' THEN 'EMPTY THUMBNAIL URL'
                    ELSE 'HAS THUMBNAIL URL'
                END as ThumbStatus
            FROM Pictures
            WHERE LOWER(PFileName) LIKE '%.mov'
            ORDER BY PFileName
        `;
        
        const movResult = await pool.request().query(movQuery);
        console.log(`Found ${movResult.recordset.length} .mov files:`);
        movResult.recordset.forEach(row => {
            console.log(`\nFile: ${row.PFileName}`);
            console.log(`  Type: ${row.PType} (1=image, 2=video)`);
            console.log(`  Dimensions: ${row.PWidth}x${row.PHeight}`);
            console.log(`  Blob URL: ${row.PBlobUrl || 'NULL'}`);
            console.log(`  Thumb URL: ${row.PThumbUrl || 'NULL'}`);
            console.log(`  Status: ${row.ThumbStatus}`);
        });
        
        // Test 2: Check for the specific JPG file
        console.log('\n=== Testing specific JPG file ===');
        const jpgQuery = `
            SELECT 
                PFileName, 
                PType,
                PBlobUrl,
                PThumbUrl,
                PWidth,
                PHeight,
                CASE 
                    WHEN PThumbUrl IS NULL THEN 'NO THUMBNAIL URL'
                    WHEN PThumbUrl = '' THEN 'EMPTY THUMBNAIL URL'
                    ELSE 'HAS THUMBNAIL URL'
                END as ThumbStatus
            FROM Pictures
            WHERE PFileName LIKE '%IMG_5033.JPG'
               OR PFileName LIKE '%IMG_5033%'
               OR PFileName LIKE '%Thanksgiving 2013%IMG_5033%'
        `;
        
        const jpgResult = await pool.request().query(jpgQuery);
        console.log(`Found ${jpgResult.recordset.length} matching file(s):`);
        jpgResult.recordset.forEach(row => {
            console.log(`\nFile: ${row.PFileName}`);
            console.log(`  Type: ${row.PType} (1=image, 2=video)`);
            console.log(`  Dimensions: ${row.PWidth}x${row.PHeight}`);
            console.log(`  Blob URL: ${row.PBlobUrl || 'NULL'}`);
            console.log(`  Thumb URL: ${row.PThumbUrl || 'NULL'}`);
            console.log(`  Status: ${row.ThumbStatus}`);
        });
        
        // Test 3: Check if Adam Hodges has tagged media
        console.log('\n=== Testing Adam Hodges tags ===');
        const adamQuery = `
            SELECT ne.ID, ne.neName
            FROM NameEvent ne
            WHERE neName LIKE '%Adam%Hodges%'
        `;
        
        const adamResult = await pool.request().query(adamQuery);
        if (adamResult.recordset.length > 0) {
            const adamId = adamResult.recordset[0].ID;
            console.log(`Adam Hodges ID: ${adamId}`);
            
            // Check tagged files
            const taggedQuery = `
                SELECT TOP 10
                    p.PFileName,
                    p.PType,
                    p.PBlobUrl,
                    p.PThumbUrl,
                    CASE 
                        WHEN p.PThumbUrl IS NULL THEN 'NO THUMBNAIL URL'
                        WHEN p.PThumbUrl = '' THEN 'EMPTY THUMBNAIL URL'
                        ELSE 'HAS THUMBNAIL URL'
                    END as ThumbStatus,
                    CASE 
                        WHEN LOWER(p.PFileName) LIKE '%.mov' THEN 'MOV'
                        WHEN LOWER(p.PFileName) LIKE '%.mp4' THEN 'MP4'
                        WHEN LOWER(p.PFileName) LIKE '%.jpg' THEN 'JPG'
                        WHEN LOWER(p.PFileName) LIKE '%.jpeg' THEN 'JPEG'
                        ELSE 'OTHER'
                    END as FileType
                FROM Pictures p
                WHERE ',' + p.PPeopleList + ',' LIKE '%,${adamId},%'
                ORDER BY p.PFileName
            `;
            
            const taggedResult = await pool.request().query(taggedQuery);
            console.log(`\nFound ${taggedResult.recordset.length} files tagged with Adam Hodges:`);
            
            const fileTypeCount = {};
            taggedResult.recordset.forEach(row => {
                const ft = row.FileType;
                fileTypeCount[ft] = (fileTypeCount[ft] || 0) + 1;
                
                if (ft === 'MOV' || row.ThumbStatus !== 'HAS THUMBNAIL URL') {
                    console.log(`\n${ft} File: ${row.PFileName}`);
                    console.log(`  Type: ${row.PType}`);
                    console.log(`  Blob URL: ${row.PBlobUrl || 'NULL'}`);
                    console.log(`  Thumb URL: ${row.PThumbUrl || 'NULL'}`);
                    console.log(`  Status: ${row.ThumbStatus}`);
                }
            });
            
            console.log('\nFile type summary:');
            Object.entries(fileTypeCount).forEach(([type, count]) => {
                console.log(`  ${type}: ${count}`);
            });
        } else {
            console.log('Adam Hodges not found in database');
        }
        
        await pool.close();
        console.log('\n✅ Test complete');
        
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

testSpecificFiles();
