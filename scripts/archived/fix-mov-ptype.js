const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Load database config
const configPath = path.join(__dirname, '..', 'api', 'local.settings.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')).Values;

const dbConfig = {
    server: config.AZURE_SQL_SERVER,
    database: config.AZURE_SQL_DATABASE,
    user: config.AZURE_SQL_USER,
    password: config.AZURE_SQL_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

async function fixMOVPType() {
    try {
        console.log('Connecting to database...');
        await sql.connect(dbConfig);
        
        // Check current state
        console.log('\n=== Current state: MOV files with PType = 3 ===');
        const before = await sql.query`
            SELECT PFileName, PType, PTime 
            FROM Pictures 
            WHERE PType = 3 
            AND (LOWER(PFileName) LIKE '%.mov' OR LOWER(PFileName) LIKE '%.mp4' OR LOWER(PFileName) LIKE '%.avi')
            ORDER BY PFileName
        `;
        console.log(`Found ${before.recordset.length} video files with PType = 3`);
        if (before.recordset.length > 0) {
            console.log('First 5 files:');
            before.recordset.slice(0, 5).forEach(row => {
                console.log(`  ${row.PFileName} (PType: ${row.PType}, Duration: ${row.PTime}s)`);
            });
        }
        
        // Update to PType = 2
        console.log('\n=== Updating PType from 3 to 2 ===');
        const result = await sql.query`
            UPDATE Pictures 
            SET PType = 2
            WHERE PType = 3 
            AND (LOWER(PFileName) LIKE '%.mov' 
                 OR LOWER(PFileName) LIKE '%.mp4' 
                 OR LOWER(PFileName) LIKE '%.avi')
        `;
        console.log(`✅ Updated ${result.rowsAffected[0]} video files from PType = 3 to PType = 2`);
        
        // Verify the fix
        console.log('\n=== Verification: Check updated files ===');
        const after = await sql.query`
            SELECT PFileName, PType, PTime 
            FROM Pictures 
            WHERE (LOWER(PFileName) LIKE '%.mov' 
                   OR LOWER(PFileName) LIKE '%.mp4' 
                   OR LOWER(PFileName) LIKE '%.avi')
            AND PType = 2
            ORDER BY PFileName
        `;
        console.log(`Found ${after.recordset.length} video files with PType = 2 (should include all MOV/MP4/AVI files)`);
        
        // Check for any remaining issues
        console.log('\n=== Check for remaining issues ===');
        const remaining = await sql.query`
            SELECT PFileName, PType, PTime 
            FROM Pictures 
            WHERE (LOWER(PFileName) LIKE '%.mov' 
                   OR LOWER(PFileName) LIKE '%.mp4' 
                   OR LOWER(PFileName) LIKE '%.avi')
            AND PType != 2
        `;
        if (remaining.recordset.length > 0) {
            console.log(`⚠️ Found ${remaining.recordset.length} video files with PType != 2:`);
            remaining.recordset.forEach(row => {
                console.log(`  ${row.PFileName} (PType: ${row.PType})`);
            });
        } else {
            console.log('✅ All video files now have correct PType = 2');
        }
        
        // Specifically check MVI_5304.MOV
        console.log('\n=== Specific check: MVI_5304.MOV ===');
        const specific = await sql.query`
            SELECT PFileName, PType, PThumbnailUrl, PTime
            FROM Pictures 
            WHERE PFileName LIKE '%MVI_5304%'
        `;
        if (specific.recordset.length > 0) {
            const file = specific.recordset[0];
            console.log(`File: ${file.PFileName}`);
            console.log(`PType: ${file.PType} ${file.PType === 2 ? '✅' : '❌'}`);
            console.log(`Has ThumbnailUrl: ${file.PThumbnailUrl ? 'Yes' : 'No (will be generated on next view)'}`);
            console.log(`Duration: ${file.PTime}s`);
        }
        
        await sql.close();
        console.log('\n✅ Fix complete!');
        console.log('\nNext steps:');
        console.log('1. The MOV files will now show as videos in the UI');
        console.log('2. Thumbnails will be generated automatically when viewing the videos');
        console.log('3. The video indicator (play button) will appear on the thumbnails');
        
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fixMOVPType();
