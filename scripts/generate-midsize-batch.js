#!/usr/bin/env node

/**
 * Batch script to generate midsize images for existing large files
 * Run this locally with: node scripts/generate-midsize-batch.js [batchSize]
 */

const sql = require('mssql');
const { BlobServiceClient } = require('@azure/storage-blob');
const sharp = require('sharp');
const path = require('path');

// Configuration
const config = {
  server: process.env.AZURE_SQL_SERVER || 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net',
  database: process.env.AZURE_SQL_DATABASE || 'FamilyAlbum',
  user: process.env.AZURE_SQL_USER || 'familyadmin',
  password: process.env.AZURE_SQL_PASSWORD || 'Jam3jam3!',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
  },
};

const storageAccount = process.env.AZURE_STORAGE_ACCOUNT || 'famprodgajerhxssqswm';
const storageKey = process.env.AZURE_STORAGE_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'family-album-media';

const BATCH_SIZE = parseInt(process.argv[2]) || 50;
const MAX_DIMENSION = 1080;
const QUALITY = 85;

let stats = {
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

async function generateMidsize(blobClient, filename) {
  try {
    // Download original
    console.log(`  Downloading: ${filename}`);
    const downloadResponse = await blobClient.download();
    const chunks = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
    const originalBuffer = Buffer.concat(chunks);

    // Get image metadata
    const metadata = await sharp(originalBuffer).metadata();
    const { width, height } = metadata;

    // Check if resizing is needed
    if (!width || !height || (width <= MAX_DIMENSION && height <= MAX_DIMENSION)) {
      console.log(`  ⊗ Skipped: ${width}x${height} already small enough`);
      return { skipped: true };
    }

    console.log(`  Resizing: ${width}x${height} → 1080px max`);

    // Resize to max 1080px while maintaining aspect ratio
    const resizedBuffer = await sharp(originalBuffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: QUALITY })
      .toBuffer();

    // Calculate size reduction
    const originalSizeMB = (originalBuffer.length / (1024 * 1024)).toFixed(2);
    const resizedSizeMB = (resizedBuffer.length / (1024 * 1024)).toFixed(2);
    const savings = ((1 - resizedBuffer.length / originalBuffer.length) * 100).toFixed(0);

    console.log(`  Size: ${originalSizeMB}MB → ${resizedSizeMB}MB (${savings}% smaller)`);

    // Upload midsize version
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    const dirname = path.dirname(filename);
    const midsizeName = path.join(dirname, `${basename}-midsize${ext}`).replace(/\\/g, '/');

    console.log(`  Uploading: ${midsizeName}`);
    
    // Get blob service client
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      `DefaultEndpointsProtocol=https;AccountName=${storageAccount};AccountKey=${storageKey};EndpointSuffix=core.windows.net`
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const midsizeBlobClient = containerClient.getBlockBlobClient(midsizeName);

    await midsizeBlobClient.uploadData(resizedBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'image/jpeg'
      }
    });

    console.log(`  ✓ Uploaded successfully`);

    return {
      success: true,
      midsizePath: midsizeName,
      originalSize: originalBuffer.length,
      midsizeSize: resizedBuffer.length
    };

  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    return {
      error: error.message
    };
  }
}

async function processBatch() {
  console.log('🖼️  Midsize Image Generator\n');
  console.log(`Batch size: ${BATCH_SIZE} images`);
  console.log(`Target dimension: ${MAX_DIMENSION}px max`);
  console.log(`Quality: ${QUALITY}%\n`);

  let pool;
  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    pool = await sql.connect(config);
    console.log('✓ Connected\n');

    // Get images needing midsize (only images >1MB)
    console.log(`📊 Finding images without midsize versions..`);
    const result = await pool.request().query(`
      SELECT TOP ${BATCH_SIZE}
        PFileName,
        PBlobUrl
      FROM Pictures
      WHERE PType = 1
        AND PMidsizeUrl IS NULL
        AND PBlobUrl IS NOT NULL
      ORDER BY PFileName
    `);

    const files = result.recordset;
    stats.total = files.length;

    console.log(`Found ${files.length} images to process\n`);

    if (files.length === 0) {
      console.log('✓ All images have midsize versions!');
      return;
    }

    // Setup blob storage
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      `DefaultEndpointsProtocol=https;AccountName=${storageAccount};AccountKey=${storageKey};EndpointSuffix=core.windows.net`
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      stats.processed++;

      console.log(`\n[${stats.processed}/${stats.total}] Processing: ${file.PFileName}`);

      try {
        const blobClient = containerClient.getBlockBlobClient(file.PFileName);

        // Check if blob exists
        const exists = await blobClient.exists();
        if (!exists) {
          console.log(`  ⊗ Blob not found in storage, skipping`);
          stats.skipped++;
          continue;
        }

        // Generate midsize
        const result = await generateMidsize(blobClient, file.PFileName);

        if (result.skipped) {
          stats.skipped++;
        } else if (result.success) {
          // Update database with midsize URL
          await pool.request()
            .input('filename', sql.NVarChar, file.PFileName)
            .input('midsizeUrl', sql.NVarChar, result.midsizePath)
            .query(`
              UPDATE Pictures
              SET PMidsizeUrl = @midsizeUrl,
                  PLastModifiedDate = GETDATE()
              WHERE PFileName = @filename
            `);

          stats.succeeded++;
          console.log(`  ✓ Database updated`);
        } else if (result.error) {
          stats.failed++;
          stats.errors.push({ file: file.PFileName, error: result.error });
        }

      } catch (error) {
        console.error(`  ✗ Failed: ${error.message}`);
        stats.failed++;
        stats.errors.push({ file: file.PFileName, error: error.message });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Batch Complete!\n');
    console.log(`Total processed: ${stats.processed}`);
    console.log(`✓ Succeeded: ${stats.succeeded}`);
    console.log(`✗ Failed: ${stats.failed}`);
    console.log(`⊗ Skipped: ${stats.skipped}`);

    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      stats.errors.forEach(err => {
        console.log(`  • ${err.file}: ${err.error}`);
      });
    }

    // Check how many more remain
    const remaining = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM Pictures
      WHERE PType = 1
        AND PMidsizeUrl IS NULL
        AND PBlobUrl IS NOT NULL
    `);

    const remainingCount = remaining.recordset[0]?.count || 0;
    console.log(`\n📈 Remaining: ${remainingCount} images still need midsize versions`);

    if (remainingCount > 0) {
      console.log(`\n💡 To process more, run: node scripts/generate-midsize-batch.js ${BATCH_SIZE}`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// Run the batch processor
processBatch().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
