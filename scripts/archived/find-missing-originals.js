// Find all Pictures database entries where the original blob doesn't exist in Azure Storage
const { query } = require('../api/shared/db');
const { blobExists, getContainerClient } = require('../api/shared/storage');

async function findMissingFiles() {
    try {
        console.log('Fetching all Pictures from database...');
        
        // Get all pictures from database
        const pictures = await query(`
            SELECT PFileName, PFileDirectory, PBlobUrl 
            FROM Pictures 
            ORDER BY PFileName
        `);
        
        console.log(`Found ${pictures.length} pictures in database\n`);
        console.log('Checking which files exist in blob storage...\n');
        
        const missing = [];
        const found = [];
        let checked = 0;
        
        for (const pic of pictures) {
            checked++;
            if (checked % 100 === 0) {
                console.log(`Checked ${checked}/${pictures.length}...`);
            }
            
            // Construct blob path the same way the API does
            let blobPath = (pic.PFileName || '').replace(/\\/g, '/').replace(/\/\//g, '/');
            blobPath = blobPath.split('/').map(s => s.trim()).join('/');
            
            try {
                // Check if blob exists using the API's utility function
                const exists = await blobExists(blobPath);
                
                if (exists) {
                    found.push({ path: blobPath, ...pic });
                } else {
                    missing.push({ path: blobPath, ...pic });
                    console.log(`❌ MISSING: ${blobPath}`);
                }
            } catch (err) {
                missing.push({ path: blobPath, error: err.message, ...pic });
                console.log(`⚠️  ERROR checking ${blobPath}: ${err.message}`);
            }
        }
        
        console.log(`\n${'='.repeat(80)}`);
        console.log('SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total in database: ${pictures.length}`);
        console.log(`Found in storage:  ${found.length}`);
        console.log(`Missing:           ${missing.length}`);
        console.log('='.repeat(80));
        
        if (missing.length > 0) {
            console.log('\n📝 Generating SQL to delete missing entries...\n');
            
            const sqlStatements = missing.map(item => {
                const escapedFileName = item.PFileName.replace(/'/g, "''");
                return `-- Missing: ${item.path}\nDELETE FROM Pictures WHERE PFileName = '${escapedFileName}';`;
            });
            
            const sqlScript = `-- SQL script to delete ${missing.length} Pictures entries for missing blobs
-- Generated: ${new Date().toISOString()}
-- 
-- WARNING: This will permanently delete database entries!
-- Review carefully before executing.

BEGIN TRANSACTION;

${sqlStatements.join('\n\n')}

-- Uncomment the next line to commit the changes:
-- COMMIT;

-- Or run this to undo:
ROLLBACK;
`;
            
            const fs = require('fs');
            const outputPath = 'scripts/delete-missing-pictures.sql';
            fs.writeFileSync(outputPath, sqlScript);
            console.log(`✅ SQL script written to: ${outputPath}`);
            console.log(`\nReview the file and run it against your database if you want to clean up these entries.\n`);
        } else {
            console.log('\n✅ All database entries have corresponding blobs in storage!\n');
        }
        
    } catch (err) {
        console.error('Error:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

findMissingFiles();
