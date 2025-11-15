/**
 * Find and convert all WMV files to MP4
 * This script:
 * 1. Queries database for all WMV files
 * 2. Downloads each from blob storage
 * 3. Converts to MP4 using FFmpeg
 * 4. Uploads MP4 back to blob storage
 * 5. Updates database to reference MP4 file
 */

const sql = require('mssql');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load settings from API local.settings.json
const localSettings = require('../api/local.settings.json');
const values = localSettings.Values;

const config = {
  server: values.AZURE_SQL_SERVER,
  database: values.AZURE_SQL_DATABASE,
  user: values.AZURE_SQL_USER,
  password: values.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

const storageAccount = values.AZURE_STORAGE_ACCOUNT;
const storageKey = values.AZURE_STORAGE_KEY;
const containerName = 'family-album-media';

async function main() {
  console.log('🔍 Finding WMV files in database...\n');

  let pool;
  try {
    // Connect to database
    pool = await sql.connect(config);
    
    // Query for WMV files
    const result = await pool.request().query(`
      SELECT PFileName, PFileDirectory, PType 
      FROM Pictures 
      WHERE LOWER(PFileName) LIKE '%.wmv'
      ORDER BY PFileName
    `);

    const wmvFiles = result.recordset;
    console.log(`Found ${wmvFiles.length} WMV files to convert\n`);

    if (wmvFiles.length === 0) {
      console.log('✓ No WMV files found. All done!');
      return;
    }

    // Initialize blob service
    const blobServiceClient = new BlobServiceClient(
      `https://${storageAccount}.blob.core.windows.net`,
      new StorageSharedKeyCredential(storageAccount, storageKey)
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Create temp directory
    const tempDir = path.join(__dirname, 'temp-conversions');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each WMV file
    for (let i = 0; i < wmvFiles.length; i++) {
      const file = wmvFiles[i];
      const fileName = file.PFileName;
      const mp4FileName = fileName.replace(/\.wmv$/i, '.mp4');

      console.log(`[${i + 1}/${wmvFiles.length}] Processing: ${fileName}`);

      try {
        // 1. Download WMV from blob storage
        console.log('  ↓ Downloading...');
        const wmvBlobClient = containerClient.getBlobClient(fileName);
        const wmvPath = path.join(tempDir, path.basename(fileName));
        const mp4Path = path.join(tempDir, path.basename(mp4FileName));

        await wmvBlobClient.downloadToFile(wmvPath);
        console.log(`  ✓ Downloaded (${(fs.statSync(wmvPath).size / 1024 / 1024).toFixed(2)} MB)`);

        // 2. Convert to MP4 using FFmpeg
        console.log('  🎬 Converting to MP4...');
        const ffmpegCmd = `ffmpeg -i "${wmvPath}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart -y "${mp4Path}"`;
        
        execSync(ffmpegCmd, { stdio: 'pipe' });
        
        const mp4Size = fs.statSync(mp4Path).size;
        console.log(`  ✓ Converted (${(mp4Size / 1024 / 1024).toFixed(2)} MB)`);

        // 3. Upload MP4 to blob storage
        console.log('  ↑ Uploading MP4...');
        const mp4BlobClient = containerClient.getBlockBlobClient(mp4FileName);
        await mp4BlobClient.uploadFile(mp4Path, {
          blobHTTPHeaders: { blobContentType: 'video/mp4' }
        });
        console.log('  ✓ Uploaded');

        // 4. Update database
        // The Pictures table has a primary key on PFileName
        // The NamePhoto table has a foreign key referencing Pictures.PFileName
        // We need to update both in a transaction
        console.log('  💾 Updating database...');
        
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        
        try {
          // First insert the new record in Pictures (with the MP4 filename)
          await transaction.request()
            .input('oldName', sql.NVarChar, fileName)
            .input('newName', sql.NVarChar, mp4FileName)
            .query(`
              -- Copy the Pictures record with new filename
              INSERT INTO Pictures (
                PFileName, PFileDirectory, PDescription, PHeight, PWidth, 
                PMonth, PYear, PPeopleList, PNameCount, PThumbnailUrl, 
                PType, PTime, PDateEntered, PLastModifiedDate, PReviewed, 
                PSoundFile, PBlobUrl
              )
              SELECT 
                @newName, PFileDirectory, PDescription, PHeight, PWidth,
                PMonth, PYear, PPeopleList, PNameCount, PThumbnailUrl,
                PType, PTime, PDateEntered, PLastModifiedDate, PReviewed,
                PSoundFile, PBlobUrl
              FROM Pictures
              WHERE PFileName = @oldName
            `);

          // Then update NamePhoto to point to the new filename
          await transaction.request()
            .input('oldName', sql.NVarChar, fileName)
            .input('newName', sql.NVarChar, mp4FileName)
            .query(`
              UPDATE NamePhoto 
              SET npFileName = @newName 
              WHERE npFileName = @oldName
            `);

          // Update FaceEmbeddings if any exist
          await transaction.request()
            .input('oldName', sql.NVarChar, fileName)
            .input('newName', sql.NVarChar, mp4FileName)
            .query(`
              UPDATE FaceEmbeddings 
              SET PhotoFileName = @newName 
              WHERE PhotoFileName = @oldName
            `);

          // Update FaceEncodings if any exist
          await transaction.request()
            .input('oldName', sql.NVarChar, fileName)
            .input('newName', sql.NVarChar, mp4FileName)
            .query(`
              UPDATE FaceEncodings 
              SET PFileName = @newName 
              WHERE PFileName = @oldName
            `);

          // Finally delete the old Pictures record
          await transaction.request()
            .input('oldName', sql.NVarChar, fileName)
            .query(`
              DELETE FROM Pictures 
              WHERE PFileName = @oldName
            `);

          await transaction.commit();
          console.log('  ✓ Database updated');
        } catch (err) {
          await transaction.rollback();
          throw err;
        }

        // 5. Delete original WMV from blob storage
        console.log('  🗑️  Deleting original WMV...');
        await wmvBlobClient.delete();
        console.log('  ✓ Original deleted');

        // Cleanup temp files
        fs.unlinkSync(wmvPath);
        fs.unlinkSync(mp4Path);

        successCount++;
        console.log(`  ✅ Complete!\n`);

      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error: ${error.message}\n`);
        
        // Cleanup on error
        try {
          const wmvPath = path.join(tempDir, path.basename(fileName));
          const mp4Path = path.join(tempDir, path.basename(mp4FileName));
          if (fs.existsSync(wmvPath)) fs.unlinkSync(wmvPath);
          if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path);
        } catch {}
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Conversion Summary:');
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ❌ Failed: ${errorCount}`);
    console.log(`  📁 Total: ${wmvFiles.length}`);
    console.log('='.repeat(50));

    // Cleanup temp directory
    try {
      fs.rmdirSync(tempDir);
    } catch {}

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main().catch(console.error);
