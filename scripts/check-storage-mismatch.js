// Check for mismatches between database and blob storage
const { BlobServiceClient } = require('@azure/storage-blob');
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

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
  options: { encrypt: true }
};

async function checkMismatches() {
  console.log('Checking for database/storage mismatches...\n');

  // Connect to database
  const pool = await sql.connect(sqlConfig);

  // Get AVI/MOV files from database
  const dbResult = await pool.request().query(`
    SELECT PFileName 
    FROM Pictures 
    WHERE (PFileName LIKE '%.avi' OR PFileName LIKE '%.AVI' OR PFileName LIKE '%.mov' OR PFileName LIKE '%.MOV')
      AND PFileName NOT LIKE 'thumbnails/%'
      AND PFileName NOT LIKE 'media/%'
    ORDER BY PFileName
  `);

  console.log(`Found ${dbResult.recordset.length} AVI/MOV files in database\n`);

  // Connect to blob storage
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Check each database file in blob storage
  let existsCount = 0;
  let missingCount = 0;
  let convertedCount = 0;

  for (const record of dbResult.recordset) {
    const filename = record.PFileName;
    const blobClient = containerClient.getBlobClient(filename);
    const exists = await blobClient.exists();

    if (exists) {
      console.log(`✓ EXISTS in storage: ${filename}`);
      existsCount++;
    } else {
      // Check if MP4 version exists
      const ext = path.extname(filename);
      const mp4Name = filename.substring(0, filename.length - ext.length) + '.mp4';
      const mp4Client = containerClient.getBlobClient(mp4Name);
      const mp4Exists = await mp4Client.exists();

      if (mp4Exists) {
        console.log(`⚠️  CONVERTED (DB not updated): ${filename} -> ${mp4Name}`);
        convertedCount++;
      } else {
        console.log(`✗ MISSING from storage: ${filename}`);
        missingCount++;
      }
    }
  }

  await pool.close();

  console.log('\n=== SUMMARY ===');
  console.log(`Files in database: ${dbResult.recordset.length}`);
  console.log(`Still AVI/MOV in storage: ${existsCount}`);
  console.log(`Converted but DB not updated: ${convertedCount}`);
  console.log(`Missing from storage: ${missingCount}`);
  
  if (convertedCount > 0) {
    console.log('\n⚠️  Some files were converted to MP4 but the database still references the AVI/MOV filename.');
    console.log('This happened because the database update step failed during conversion.');
  }
}

checkMismatches().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
