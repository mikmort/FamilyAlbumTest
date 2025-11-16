/**
 * Fix Missing Events in PPeopleList
 * 
 * This script finds events (neType='E') in NamePhoto that are missing from PPeopleList
 * and adds them to the beginning of PPeopleList for their corresponding photos.
 * 
 * Usage: node scripts/fix-missing-events.js
 */

const { query, execute } = require('../api/shared/db');

async function fixMissingEvents() {
    console.log('🔍 Checking for photos with events in NamePhoto but missing from PPeopleList...\n');

    try {
        // Find photos that need fixing
        const photosToFix = await query(`
            SELECT DISTINCT
                p.PFileName,
                p.PPeopleList,
                np.npID as EventID,
                ne.neName as EventName
            FROM dbo.Pictures p
            INNER JOIN dbo.NamePhoto np ON np.npFileName = p.PFileName
            INNER JOIN dbo.NameEvent ne ON ne.ID = np.npID AND ne.neType = 'E'
            WHERE 
                (p.PPeopleList IS NULL 
                 OR p.PPeopleList = '' 
                 OR ',' + p.PPeopleList + ',' NOT LIKE '%,' + CAST(np.npID AS VARCHAR) + ',%')
            ORDER BY p.PFileName
        `);

        if (photosToFix.length === 0) {
            console.log('✅ No photos need fixing! All events in NamePhoto are already in PPeopleList.');
            return;
        }

        console.log(`📋 Found ${photosToFix.length} photos that need fixing:\n`);

        // Show first 10 as examples
        photosToFix.slice(0, 10).forEach(photo => {
            console.log(`  - ${photo.PFileName}`);
            console.log(`    Event: ${photo.EventName} (ID: ${photo.EventID})`);
            console.log(`    Current PPeopleList: ${photo.PPeopleList || '(empty)'}\n`);
        });

        if (photosToFix.length > 10) {
            console.log(`  ... and ${photosToFix.length - 10} more\n`);
        }

        // Ask for confirmation
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const confirm = await new Promise((resolve) => {
            readline.question('Do you want to proceed with the fix? (yes/no): ', (answer) => {
                readline.close();
                resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
            });
        });

        if (!confirm) {
            console.log('\n❌ Fix cancelled by user.');
            return;
        }

        console.log('\n🔧 Fixing photos...\n');

        let fixed = 0;
        let errors = 0;

        for (const photo of photosToFix) {
            try {
                // Build new PPeopleList with event ID at the beginning
                const currentList = photo.PPeopleList || '';
                const newPPeopleList = currentList 
                    ? `${photo.EventID},${currentList}`
                    : `${photo.EventID}`;

                // Update the Pictures table
                await execute(`
                    UPDATE dbo.Pictures
                    SET PPeopleList = @newList,
                        PLastModifiedDate = GETDATE()
                    WHERE PFileName = @filename
                `, {
                    newList: newPPeopleList,
                    filename: photo.PFileName
                });

                console.log(`✅ ${photo.PFileName}`);
                console.log(`   ${currentList || '(empty)'} → ${newPPeopleList}\n`);
                
                fixed++;
            } catch (error) {
                console.error(`❌ Error fixing ${photo.PFileName}:`, error.message);
                errors++;
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Fixed: ${fixed}`);
        console.log(`   ❌ Errors: ${errors}`);
        console.log(`   📝 Total: ${photosToFix.length}\n`);

        // Verify the fix
        const remainingIssues = await query(`
            SELECT COUNT(DISTINCT p.PFileName) as Count
            FROM dbo.Pictures p
            INNER JOIN dbo.NamePhoto np ON np.npFileName = p.PFileName
            INNER JOIN dbo.NameEvent ne ON ne.ID = np.npID AND ne.neType = 'E'
            WHERE 
                (p.PPeopleList IS NULL 
                 OR p.PPeopleList = '' 
                 OR ',' + p.PPeopleList + ',' NOT LIKE '%,' + CAST(np.npID AS VARCHAR) + ',%')
        `);

        if (remainingIssues[0].Count === 0) {
            console.log('✅ Verification: All events are now in PPeopleList!');
        } else {
            console.log(`⚠️ Verification: ${remainingIssues[0].Count} photos still have issues.`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run the fix
fixMissingEvents()
    .then(() => {
        console.log('\n✅ Script completed.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
