const sql = require('mssql');
const config = require('../api/local.settings.json').Values;

async function cleanupOrphanedMov() {
  try {
    const pool = await sql.connect({
      server: config.AZURE_SQL_SERVER,
      database: config.AZURE_SQL_DATABASE,
      user: config.AZURE_SQL_USER,
      password: config.AZURE_SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false }
    });

    const fileName = 'MVI_5747.MOV';
    
    console.log(`\n🔍 Checking orphaned entry: ${fileName}...`);

    // Check if there are any NamePhoto references
    const namePhotoCheck = await pool.request()
      .input('fileName', sql.VarChar, fileName)
      .query('SELECT COUNT(*) as count FROM NamePhoto WHERE npFileName = @fileName');

    const refCount = namePhotoCheck.recordset[0].count;
    console.log(`   References in NamePhoto: ${refCount}`);

    if (refCount > 0) {
      console.log('⚠️  Cannot delete - there are still references. Need to update them first.');
      
      // Check if MP4 version exists
      const mp4Check = await pool.request()
        .input('mp4Name', sql.VarChar, 'MVI_5747.mp4')
        .query('SELECT PFileName FROM Pictures WHERE PFileName = @mp4Name');
      
      if (mp4Check.recordset.length > 0) {
        console.log('✅ MP4 version exists');
        
        // Check if MP4 references already exist
        const mp4RefCheck = await pool.request()
          .input('mp4Name', sql.VarChar, 'MVI_5747.mp4')
          .query('SELECT npID FROM NamePhoto WHERE npFileName = @mp4Name');
        
        const mp4Refs = new Set(mp4RefCheck.recordset.map(r => r.npID));
        console.log(`   MP4 already has ${mp4Refs.size} references`);
        
        // Get MOV references
        const movRefCheck = await pool.request()
          .input('movName', sql.VarChar, fileName)
          .query('SELECT npID FROM NamePhoto WHERE npFileName = @movName');
        
        console.log(`   MOV has ${movRefCheck.recordset.length} references`);
        
        // Update only references that don't exist for MP4
        let updated = 0;
        for (const row of movRefCheck.recordset) {
          if (!mp4Refs.has(row.npID)) {
            await pool.request()
              .input('movName', sql.VarChar, fileName)
              .input('mp4Name', sql.VarChar, 'MVI_5747.mp4')
              .input('nameId', sql.Int, row.npID)
              .query('UPDATE NamePhoto SET npFileName = @mp4Name WHERE npFileName = @movName AND npID = @nameId');
            updated++;
          }
        }
        
        if (updated > 0) {
          console.log(`✅ Updated ${updated} unique references to MP4`);
        }
        
        // Delete remaining duplicates
        const deleteRefs = await pool.request()
          .input('movName', sql.VarChar, fileName)
          .query('DELETE FROM NamePhoto WHERE npFileName = @movName');
        
        if (deleteRefs.rowsAffected[0] > 0) {
          console.log(`✅ Deleted ${deleteRefs.rowsAffected[0]} duplicate MOV references`);
        }
      } else {
        console.log('❌ No MP4 version found. Deleting references...');
        
        await pool.request()
          .input('movName', sql.VarChar, fileName)
          .query('DELETE FROM NamePhoto WHERE npFileName = @movName');
        
        console.log('✅ References deleted');
      }
    }

    // Now delete the Pictures entry
    const deleteResult = await pool.request()
      .input('fileName', sql.VarChar, fileName)
      .query('DELETE FROM Pictures WHERE PFileName = @fileName');

    console.log(`✅ Deleted orphaned entry: ${fileName}`);
    console.log(`   Rows affected: ${deleteResult.rowsAffected[0]}`);

    await pool.close();
    console.log('\n✅ Cleanup complete!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupOrphanedMov();
