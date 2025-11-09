// Fix database references for successfully converted files
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const localSettings = JSON.parse(fs.readFileSync(path.join(__dirname, '../api/local.settings.json'), 'utf8'));
const values = localSettings.Values;

const sqlConfig = {
  server: values.AZURE_SQL_SERVER,
  database: values.AZURE_SQL_DATABASE,
  user: values.AZURE_SQL_USER,
  password: values.AZURE_SQL_PASSWORD,
  options: { encrypt: true }
};

// These are the 39 files that were converted but DB wasn't updated
const filesToFix = [
  'Events/Thanksgiving/Thanksgiving 2006/MVI_0995.AVI',
  'Events/Thanksgiving/Thanksgiving 2006/MVI_0996.AVI',
  'Events/Thanksgiving/Thanksgiving 2006/MVI_1116.AVI',
  'Events/Thanksgiving/Thanksgiving 2006/MVI_3597.AVI',
  'Events/Thanksgiving/Thanksgiving 2006/MVI_3634.AVI',
  'Events/Thanksgiving/Thanksgiving 2006/MVI_3635.AVI',
  'Events/Thanksgiving/Thanksgiving 2006/MVI_3638.AVI',
  'Events/Thanksgiving/Thanksgiving 2006/MVI_3650.AVI',
  'Events/Thanksgiving/Thanksgiving 2006/MVI_3660.AVI',
  'Family Pictures/Amys Pictures/MVI_0016.avi',
  'Family Pictures/Amys Pictures/MVI_0021.avi',
  'Family Pictures/Amys Pictures/MVI_0077.avi',
  'Family Pictures/Amys Pictures/MVI_0078.avi',
  'Family Pictures/Amys Pictures/MVI_0079.avi',
  'On Location/Charlottesville 2006/Charlottesville July 2006/MVI_3233.AVI',
  'On Location/Charlottesville 2006/Charlottesville July 2006/MVI_3234.AVI',
  'On Location/Charlottesville 2006/Charlottesville July 2006/MVI_3247.AVI',
  'On Location/Charlotttesville April 2007/MVI_4378.AVI',
  'On Location/Charlotttesville April 2007/MVI_4383.AVI',
  'On Location/Florida 2006/MVI_0253.AVI',
  'On Location/Florida 2006/MVI_0254.AVI',
  'On Location/Florida 2006/MVI_1048.AVI',
  'On Location/Florida 2006/MVI_1049.AVI',
  'On Location/Florida 2006/MVI_1050.AVI',
  'On Location/Florida 2006/MVI_1052.AVI',
  'On Location/Florida May 2006/MVI_0455.AVI',
  'On Location/Florida May 2006/MVI_2807.AVI',
  'On Location/Florida May 2006/MVI_2808.AVI',
  'On Location/Florida May 2006/MVI_2841.AVI',
  'On Location/Florida May 2006/MVI_2844.AVI',
  'On Location/Florida2004/MVI_0770.avi',
  'On Location/Florida2004/MVI_0771.avi',
  'On Location/Florida2004/MVI_0772.avi',
  'On Location/Florida2004/MVI_0773.avi',
  'On Location/Milwaukee2004/AmysPictures/MVI_0260.AVI',
  'On Location/Milwaukee2004/AmysPictures/MVI_0317.AVI',
  'On Location/Milwaukee2004/AprilMay/MVI_0916.AVI',
  'On Location/Milwaukee2004/AprilMay/MVI_0917.AVI',
  'On Location/Toxaway/MVI_0005.avi'
];

async function fixDatabase() {
  console.log('=== Fixing Database References ===\n');
  console.log(`Files to update: ${filesToFix.length}\n`);

  const pool = await sql.connect(sqlConfig);
  
  let successCount = 0;
  let errorCount = 0;

  for (const oldName of filesToFix) {
    const ext = path.extname(oldName);
    const newName = oldName.substring(0, oldName.length - ext.length) + '.mp4';

    try {
      // Need to work around foreign key constraint:
      // 1. Insert new Pictures record with MP4 name (copy all data from AVI record)
      // 2. Update NamePhoto to reference new MP4 name
      // 3. Delete old AVI Pictures record
      
      const result = await pool.request()
        .input('oldName', sql.VarChar, oldName)
        .input('newName', sql.VarChar, newName)
        .query(`
          -- Insert new Pictures record with all columns from original
          INSERT INTO Pictures (PFileName, PFileDirectory, PDescription, PHeight, PWidth, PMonth, PYear, 
                                PPeopleList, PNameCount, PThumbnailUrl, PType, PTime, 
                                PDateEntered, PLastModifiedDate, PReviewed, PSoundFile, PBlobUrl)
          SELECT @newName, PFileDirectory, PDescription, PHeight, PWidth, PMonth, PYear,
                 PPeopleList, PNameCount, PThumbnailUrl, PType, PTime,
                 PDateEntered, PLastModifiedDate, PReviewed, PSoundFile, PBlobUrl
          FROM Pictures WHERE PFileName = @oldName;
          
          -- Update NamePhoto references
          UPDATE NamePhoto SET npFileName = @newName WHERE npFileName = @oldName;
          
          -- Delete old Pictures record
          DELETE FROM Pictures WHERE PFileName = @oldName;
        `);

      console.log(`✓ ${oldName} -> ${newName}`);
      successCount++;
    } catch (err) {
      console.error(`✗ Failed to update ${oldName}:`, err.message);
      errorCount++;
    }
  }

  await pool.close();

  console.log('\n=== SUMMARY ===');
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('\nDatabase is now in sync with blob storage!');
}

fixDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
