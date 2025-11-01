// Update database after video conversion from MOV to MP4
// This script updates the Pictures table to reference the new .mp4 files instead of .MOV files

const { query, execute } = require('../api/shared/db');
const { blobExists } = require('../api/shared/storage');

async function updateDatabase() {
    try {
        console.log('Finding MOV entries in database that have been converted to MP4...\n');
        
        // Get all Pictures with .MOV extension
        const movPictures = await query(`
            SELECT PFileName, PFileDirectory, PBlobUrl 
            FROM Pictures 
            WHERE PFileName LIKE '%.MOV' OR PFileName LIKE '%.mov'
            ORDER BY PFileName
        `);
        
        console.log(`Found ${movPictures.length} MOV entries in database\n`);
        
        let checked = 0;
        let converted = 0;
        let notConverted = 0;
        const updates = [];
        
        for (const pic of movPictures) {
            checked++;
            
            if (checked % 10 === 0) {
                console.log(`Checked ${checked}/${movPictures.length}...`);
            }
            
            // Generate MP4 filename
            const mp4FileName = pic.PFileName.replace(/\.MOV$/i, '.mp4');
            
            // Construct full blob path
            let mp4BlobPath = mp4FileName;
            if (pic.PFileDirectory && pic.PFileDirectory.trim() !== '') {
                mp4BlobPath = pic.PFileDirectory + '/' + mp4FileName;
            }
            mp4BlobPath = mp4BlobPath.replace(/\\/g, '/').replace(/\/\//g, '/');
            
            // Check if MP4 version exists in blob storage
            try {
                const exists = await blobExists(mp4BlobPath);
                
                if (exists) {
                    converted++;
                    console.log(`✅ Found MP4: ${mp4BlobPath}`);
                    
                    updates.push({
                        oldFileName: pic.PFileName,
                        newFileName: mp4FileName,
                        blobPath: mp4BlobPath
                    });
                } else {
                    notConverted++;
                }
            } catch (err) {
                console.log(`⚠️  Error checking ${mp4BlobPath}: ${err.message}`);
                notConverted++;
            }
        }
        
        console.log(`\n${'='.repeat(80)}`);
        console.log('SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total MOV entries:     ${movPictures.length}`);
        console.log(`Converted to MP4:      ${converted}`);
        console.log(`Not yet converted:     ${notConverted}`);
        console.log('='.repeat(80));
        
        if (updates.length === 0) {
            console.log('\nNo updates needed - no converted MP4 files found.');
            return;
        }
        
        console.log(`\n📝 Generating SQL update script...\n`);
        
        // Generate SQL script
        const sqlStatements = updates.map(update => {
            const escapedOld = update.oldFileName.replace(/'/g, "''");
            const escapedNew = update.newFileName.replace(/'/g, "''");
            
            return `-- ${update.oldFileName} -> ${update.newFileName}
UPDATE Pictures 
SET PFileName = '${escapedNew}'
WHERE PFileName = '${escapedOld}';`;
        });
        
        const sqlScript = `-- SQL script to update Pictures table after MOV to MP4 conversion
-- Generated: ${new Date().toISOString()}
-- Updates ${updates.length} entries
--
-- This script updates PFileName from .MOV to .mp4 for converted videos

BEGIN TRANSACTION;

${sqlStatements.join('\n\n')}

-- Verify the updates
SELECT 
    COUNT(*) as UpdatedCount,
    'Updated to MP4' as Status
FROM Pictures 
WHERE PFileName LIKE '%.mp4' 
  AND PFileName IN (${updates.map(u => `'${u.newFileName.replace(/'/g, "''")}'`).join(', ')});

-- Uncomment the next line to commit the changes:
-- COMMIT;

-- Or run this to undo:
ROLLBACK;
`;
        
        const fs = require('fs');
        const outputPath = 'scripts/update-mov-to-mp4.sql';
        fs.writeFileSync(outputPath, sqlScript);
        console.log(`✅ SQL script written to: ${outputPath}`);
        console.log(`\nReview the file and run it against your database to update the entries.\n`);
        
        console.log('After running the SQL script:');
        console.log('1. The database will reference the new .mp4 files');
        console.log('2. Thumbnails will be regenerated automatically on next view');
        console.log('3. Videos will play in browsers without downloading');
        console.log('4. You can optionally delete the old .MOV files from blob storage\n');
        
    } catch (err) {
        console.error('Error:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

updateDatabase();
