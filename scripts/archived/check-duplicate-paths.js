// Check for files with duplicate paths or Windows drive letters in the database
const { query } = require('../api/shared/db');

async function checkDuplicatePaths() {
    try {
        console.log('🔍 Checking for problematic file paths in database...\n');
        
        // Check for files with duplicate directory paths
        const duplicateResults = await query(`
            SELECT 
                PFileName,
                -- PFileDirectory (ignored)
                CASE 
                    -- WHEN PFileName LIKE '%' || PFileDirectory || '%' THEN 'DUPLICATE'
                    WHEN PFileName LIKE 'B:%' OR PFileName LIKE 'C:%' OR PFileName LIKE 'D:%' THEN 'HAS DRIVE LETTER'
                    WHEN PFileDirectory LIKE 'B:%' OR PFileDirectory LIKE 'C:%' OR PFileDirectory LIKE 'D:%' THEN 'DIR HAS DRIVE LETTER'
                    ELSE 'OK'
                END as Issue
            FROM Media
            WHERE 
                -- (PFileName LIKE '%' || PFileDirectory || '%' AND PFileDirectory IS NOT NULL AND PFileDirectory != '')
                OR PFileName LIKE 'B:%'
                OR PFileName LIKE 'C:%'
                OR PFileName LIKE 'D:%'
                OR PFileDirectory LIKE 'B:%'
                OR PFileDirectory LIKE 'C:%'
                OR PFileDirectory LIKE 'D:%'
            LIMIT 20
        `);
        
        console.log(`Found ${duplicateResults.length} files with path issues:\n`);
        
        duplicateResults.forEach(row => {
            console.log(`Issue: ${row.Issue}`);
            // console.log(`  PFileDirectory: "${row.PFileDirectory}"`);
            console.log(`  PFileName: "${row.PFileName}"`);
            console.log('');
        });
        
        // Count total issues
        const counts = await query(`
            SELECT 
                COUNT(*) as Total,
                SUM(CASE WHEN PFileName LIKE 'B:%' OR PFileName LIKE 'C:%' OR PFileName LIKE 'D:%' THEN 1 ELSE 0 END) as WithDriveLetter,
                SUM(CASE WHEN PFileName LIKE '%Events/Birthdays%Events/Birthdays%' THEN 1 ELSE 0 END) as WithDuplicatePath
            FROM Media
        `);
        
        console.log('📊 Summary:');
        console.log(`  Total media files: ${counts[0].Total}`);
        console.log(`  Files with drive letters: ${counts[0].WithDriveLetter}`);
        console.log(`  Files with duplicate paths: ${counts[0].WithDuplicatePath}`);
        
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err.stack);
    }
}

checkDuplicatePaths();
