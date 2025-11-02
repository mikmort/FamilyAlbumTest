/**
 * Generate SQL update script by checking which MP4 files exist in blob storage
 * This version doesn't require database connection - just checks blob storage
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');

const storageAccount = 'famprodgajerhxssqswm';
const containerName = 'family-album-media';
const storageKey = process.env.AZURE_STORAGE_KEY;

if (!storageKey) {
  console.error('❌ AZURE_STORAGE_KEY environment variable not set');
  process.exit(1);
}

const blobServiceClient = new BlobServiceClient(
  `https://${storageAccount}.blob.core.windows.net`,
  new (require('@azure/storage-blob').StorageSharedKeyCredential)(storageAccount, storageKey)
);

const containerClient = blobServiceClient.getContainerClient(containerName);

async function generateSQL() {
  try {
    console.log('=' .repeat(80));
    console.log('Generate Database Update SQL');
    console.log('='.repeat(80));
    console.log(`Storage: ${storageAccount}/${containerName}`);
    console.log('='.repeat(80));
    console.log('');
    
    console.log('🔍 Finding MOV and MP4 files in blob storage...');
    
    const movFiles = new Map(); // Map of MOV filename -> blob path
    const mp4Files = new Set(); // Set of MP4 blob paths
    
    // Find all MOV and MP4 files
    for await (const blob of containerClient.listBlobsFlat()) {
      if (blob.name.match(/\.MOV$/i)) {
        // Skip thumbnail files
        if (!blob.name.startsWith('thumbnails/')) {
          movFiles.set(blob.name, blob.name);
        }
      } else if (blob.name.match(/\.mp4$/i)) {
        // Skip thumbnail files
        if (!blob.name.startsWith('thumbnails/')) {
          mp4Files.add(blob.name);
        }
      }
    }
    
    console.log(`   Found ${movFiles.size} MOV files`);
    console.log(`   Found ${mp4Files.size} MP4 files`);
    console.log('');
    
    console.log('🔍 Checking which MOV files have MP4 equivalents...');
    
    const updates = [];
    let checked = 0;
    
    for (const [movPath, movBlobName] of movFiles.entries()) {
      checked++;
      
      if (checked % 10 === 0) {
        process.stdout.write(`   Checked ${checked}/${movFiles.size}...\r`);
      }
      
      // Generate MP4 equivalent path
      const mp4Path = movPath.replace(/\.MOV$/i, '.mp4');
      
      if (mp4Files.has(mp4Path)) {
        const movFileName = path.basename(movPath);
        const mp4FileName = path.basename(mp4Path);
        
        updates.push({
          movPath,
          mp4Path,
          movFileName,
          mp4FileName
        });
      }
    }
    
    console.log(`   Checked ${movFiles.size}/${movFiles.size}...`);
    console.log('');
    
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total MOV files:       ${movFiles.size}`);
    console.log(`Converted to MP4:      ${updates.length}`);
    console.log(`Not yet converted:     ${movFiles.size - updates.length}`);
    console.log('='.repeat(80));
    console.log('');
    
    if (updates.length === 0) {
      console.log('❌ No conversions found. Run the conversion script first.');
      return;
    }
    
    console.log('📝 Generating SQL update script...');
    console.log('');
    
    // Generate SQL script
    const sqlStatements = updates.map(update => {
      const escapedMovFile = update.movFileName.replace(/'/g, "''");
      const escapedMp4File = update.mp4FileName.replace(/'/g, "''");
      
      return `-- ${update.movFileName} -> ${update.mp4FileName}
UPDATE Pictures 
SET PFileName = '${escapedMp4File}'
WHERE PFileName = '${escapedMovFile}';`;
    });
    
    const sqlScript = `-- SQL script to update Pictures table after MOV to MP4 conversion
-- Generated: ${new Date().toISOString()}
-- Updates ${updates.length} entries
--
-- This script updates PFileName from .MOV to .mp4 for converted videos
-- The MP4 files exist in blob storage and are ready to use

BEGIN TRANSACTION;

${sqlStatements.join('\n\n')}

-- Verify the updates
SELECT 
    COUNT(*) as UpdatedCount,
    'Ready to be updated to MP4' as Status
FROM Pictures 
WHERE PFileName IN (${updates.slice(0, 10).map(u => `'${u.movFileName.replace(/'/g, "''")}'`).join(', ')}${updates.length > 10 ? ', ...' : ''});

-- Review the updates above, then uncomment COMMIT to apply changes:
-- COMMIT;

-- Or run ROLLBACK to undo:
-- ROLLBACK;

-- After committing:
-- 1. Videos will reference .mp4 files
-- 2. Videos will play in browser without download
-- 3. Thumbnails will regenerate automatically
-- 4. You can optionally delete old .MOV files from blob storage
`;
    
    const outputPath = path.join(__dirname, 'update-mov-to-mp4.sql');
    fs.writeFileSync(outputPath, sqlScript);
    
    console.log('✅ SQL script generated successfully!');
    console.log(`   File: ${outputPath}`);
    console.log('');
    console.log('='.repeat(80));
    console.log('NEXT STEPS');
    console.log('='.repeat(80));
    console.log('1. Open scripts/update-mov-to-mp4.sql in Azure Data Studio');
    console.log('2. Review the UPDATE statements');
    console.log('3. Uncomment the COMMIT line to apply changes');
    console.log('4. Execute the script against your Azure SQL database');
    console.log('');
    console.log('After running the SQL:');
    console.log('• Videos will reference .mp4 files');
    console.log('• Videos will play in browsers');
    console.log('• Thumbnails will regenerate automatically');
    console.log('='.repeat(80));
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

generateSQL();
