// Script to convert AVI and MOV files to MP4 in Azure Blob Storage
const { BlobServiceClient } = require('@azure/storage-blob');
const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// Load configuration
const localSettings = JSON.parse(fs.readFileSync(path.join(__dirname, '../api/local.settings.json'), 'utf8'));
const values = localSettings.Values;

const storageAccount = values.AZURE_STORAGE_ACCOUNT;
const storageKey = values.AZURE_STORAGE_KEY;
const connectionString = `DefaultEndpointsProtocol=https;AccountName=${storageAccount};AccountKey=${storageKey};EndpointSuffix=core.windows.net`;
const containerName = 'family-album-media';

const sqlConfig = {
  server: values.AZURE_SQL_SERVER,
  database: values.AZURE_SQL_DATABASE,
  user: values.AZURE_SQL_USER,
  password: values.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

const DRY_RUN = process.argv.includes('--dry-run');

async function convertVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-y',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', reject);
  });
}

async function main() {
  console.log('========================================');
  console.log('Convert AVI/MOV to MP4');
  console.log('========================================\n');

  if (DRY_RUN) {
    console.log('DRY RUN MODE - No changes will be made\n');
  }

  // Connect to blob storage
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Connect to database
  let pool;
  try {
    pool = await sql.connect(sqlConfig);
    console.log('✓ Connected to database\n');
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }

  // Find all AVI and MOV files
  console.log('Searching for AVI and MOV files...');
  const filesToConvert = [];
  
  for await (const blob of containerClient.listBlobsFlat()) {
    const ext = path.extname(blob.name).toLowerCase();
    if (ext === '.avi' || ext === '.mov') {
      filesToConvert.push(blob.name);
    }
  }

  console.log(`Found ${filesToConvert.length} files to convert:\n`);
  filesToConvert.forEach(f => console.log(`  - ${f}`));
  console.log('');

  if (filesToConvert.length === 0) {
    console.log('No files to convert.');
    await pool.close();
    return;
  }

  // Create temp directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-conversion-'));
  console.log(`Using temp directory: ${tempDir}\n`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (const blobName of filesToConvert) {
    console.log('----------------------------------------');
    console.log(`Processing: ${blobName}`);

    try {
      // Generate new filename
      const ext = path.extname(blobName);
      const newName = blobName.substring(0, blobName.length - ext.length) + '.mp4';

      // Check if MP4 already exists
      const mp4Client = containerClient.getBlobClient(newName);
      const exists = await mp4Client.exists();
      
      if (exists) {
        console.log(`  ⚠️  MP4 version already exists: ${newName}`);
        console.log('  Skipping...');
        skippedCount++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would convert: ${blobName} -> ${newName}`);
        successCount++;
        continue;
      }

      // Download original file
      const inputPath = path.join(tempDir, `input${ext}`);
      const outputPath = path.join(tempDir, 'output.mp4');
      
      console.log('  Downloading...');
      const blobClient = containerClient.getBlobClient(blobName);
      await blobClient.downloadToFile(inputPath);
      
      const inputSize = fs.statSync(inputPath).size;
      console.log(`  Downloaded: ${(inputSize / 1024 / 1024).toFixed(2)} MB`);

      // Convert to MP4
      console.log('  Converting to MP4...');
      await convertVideo(inputPath, outputPath);
      
      const outputSize = fs.statSync(outputPath).size;
      console.log(`  Converted: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);

      // Upload MP4
      console.log('  Uploading MP4...');
      const newBlobClient = containerClient.getBlockBlobClient(newName);
      await newBlobClient.uploadFile(outputPath, {
        blobHTTPHeaders: { blobContentType: 'video/mp4' }
      });
      console.log(`  ✓ Uploaded: ${newName}`);

      // Update database
      console.log('  Updating database...');
      try {
        await pool.request()
          .input('oldName', sql.VarChar, blobName)
          .input('newName', sql.VarChar, newName)
          .query(`
            UPDATE Pictures SET PFileName = @newName WHERE PFileName = @oldName;
            UPDATE NamePhoto SET npFileName = @newName WHERE npFileName = @oldName;
          `);
        console.log('  ✓ Database updated');
      } catch (dbErr) {
        console.log(`  ⚠️  Database update failed: ${dbErr.message}`);
        console.log('     You\'ll need to manually update the database.');
      }

      // Delete original file
      console.log('  Deleting original file...');
      await blobClient.delete();
      console.log(`  ✓ Deleted: ${blobName}`);

      // Clean up temp files
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);

      console.log(`✓ Successfully converted: ${blobName} -> ${newName}`);
      successCount++;

    } catch (err) {
      console.error(`✗ Failed to convert ${blobName}:`, err.message);
      failCount++;
    }
  }

  // Clean up
  fs.rmdirSync(tempDir, { recursive: true });
  await pool.close();

  console.log('\n');
  console.log('========================================');
  console.log('Conversion Complete');
  console.log('========================================');
  console.log(`Success: ${successCount}`);
  console.log(`Failed:  ${failCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
