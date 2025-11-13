const sql = require('mssql');
const { BlobServiceClient } = require('@azure/storage-blob');
const config = require('../api/local.settings.json').Values;

async function wholisticPathCheck() {
  let pool;
  
  try {
    // Connect to database
    pool = await sql.connect({
      server: config.AZURE_SQL_SERVER,
      database: config.AZURE_SQL_DATABASE,
      user: config.AZURE_SQL_USER,
      password: config.AZURE_SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false }
    });
    console.log('✅ Connected to database\n');

    // Get statistics on path patterns
    console.log('='.repeat(80));
    console.log('DATABASE ANALYSIS');
    console.log('='.repeat(80));
    
    const statsResult = await pool.request().query(`
      SELECT 
        COUNT(*) as TotalImages,
        SUM(CASE WHEN PMidsizeUrl IS NOT NULL THEN 1 ELSE 0 END) as WithMidsizeUrl,
        SUM(CASE WHEN PBlobUrl IS NOT NULL THEN 1 ELSE 0 END) as WithBlobUrl,
        SUM(CASE WHEN PBlobUrl IS NULL THEN 1 ELSE 0 END) as WithoutBlobUrl
      FROM Pictures
    `);
    
    console.log('\n📊 Overall Statistics:');
    console.log(`Total images: ${statsResult.recordset[0].TotalImages}`);
    console.log(`Images with PMidsizeUrl: ${statsResult.recordset[0].WithMidsizeUrl}`);
    console.log(`Images with PBlobUrl: ${statsResult.recordset[0].WithBlobUrl}`);
    console.log(`Images without PBlobUrl (old images): ${statsResult.recordset[0].WithoutBlobUrl}`);

    // Check path separator patterns in PFileDirectory
    const dirResult = await pool.request().query(`
      SELECT 
        CASE 
          WHEN PFileDirectory LIKE '%\\%' THEN 'Backslash'
          WHEN PFileDirectory LIKE '%/%' THEN 'Forward Slash'
          WHEN PFileDirectory IS NULL THEN 'NULL'
          ELSE 'No Separator'
        END as SeparatorType,
        COUNT(*) as Count
      FROM Pictures
      GROUP BY 
        CASE 
          WHEN PFileDirectory LIKE '%\\%' THEN 'Backslash'
          WHEN PFileDirectory LIKE '%/%' THEN 'Forward Slash'
          WHEN PFileDirectory IS NULL THEN 'NULL'
          ELSE 'No Separator'
        END
      ORDER BY Count DESC
    `);

    console.log('\n📁 PFileDirectory Path Separator Patterns:');
    for (const row of dirResult.recordset) {
      console.log(`  ${row.SeparatorType}: ${row.Count} images`);
    }

    // Check PFileName patterns
    const fileResult = await pool.request().query(`
      SELECT 
        CASE 
          WHEN PFileName LIKE '%\\%' THEN 'Backslash'
          WHEN PFileName LIKE '%/%' THEN 'Forward Slash'
          ELSE 'No Separator'
        END as SeparatorType,
        COUNT(*) as Count
      FROM Pictures
      GROUP BY 
        CASE 
          WHEN PFileName LIKE '%\\%' THEN 'Backslash'
          WHEN PFileName LIKE '%/%' THEN 'Forward Slash'
          ELSE 'No Separator'
        END
      ORDER BY Count DESC
    `);

    console.log('\n📄 PFileName Path Separator Patterns:');
    for (const row of fileResult.recordset) {
      console.log(`  ${row.SeparatorType}: ${row.Count} images`);
    }

    // Sample images with different patterns
    console.log('\n📋 Sample Images (showing path patterns):\n');
    
    const sampleResult = await pool.request().query(`
      SELECT TOP 5
        PFileName,
        PFileDirectory,
        PMidsizeUrl,
        CASE WHEN PBlobUrl IS NULL THEN 'NULL' ELSE LEFT(PBlobUrl, 60) + '...' END as PBlobUrl_Sample
      FROM Pictures
      WHERE PMidsizeUrl IS NOT NULL
      ORDER BY PFileName
    `);

    for (const img of sampleResult.recordset) {
      console.log(`PFileName: ${img.PFileName}`);
      console.log(`PFileDirectory: ${img.PFileDirectory}`);
      console.log(`PMidsizeUrl: ${img.PMidsizeUrl}`);
      console.log(`PBlobUrl: ${img.PBlobUrl_Sample}`);
      console.log('---');
    }

    // Check for potential issues with Whistler-like paths
    const mismatchResult = await pool.request().query(`
      SELECT 
        PFileName,
        PFileDirectory,
        PMidsizeUrl
      FROM Pictures
      WHERE PFileDirectory LIKE '%\\%'
        AND PMidsizeUrl IS NOT NULL
      ORDER BY PFileName
    `);

    console.log(`\n⚠️  Images with backslashes in PFileDirectory but have PMidsizeUrl: ${mismatchResult.recordset.length}`);
    if (mismatchResult.recordset.length > 0) {
      console.log('\nFirst 10 examples:');
      for (const img of mismatchResult.recordset.slice(0, 10)) {
        console.log(`  ${img.PFileName}`);
        console.log(`    Dir: ${img.PFileDirectory}`);
        console.log(`    Midsize: ${img.PMidsizeUrl}`);
      }
    }

    // Now check blob storage
    console.log('\n' + '='.repeat(80));
    console.log('BLOB STORAGE ANALYSIS');
    console.log('='.repeat(80));

    const blobServiceClient = BlobServiceClient.fromConnectionString(
      config.AZURE_STORAGE_CONNECTIONSTRING
    );
    const containerClient = blobServiceClient.getContainerClient('family-album-media');

    console.log('\n🔍 Sampling blob storage structure...\n');

    // Sample some blobs to understand structure
    const blobSamples = {
      midsizeCount: 0,
      fullsizeCount: 0,
      withMediaPrefix: 0,
      withoutMediaPrefix: 0,
      backslashPaths: 0,
      forwardSlashPaths: 0,
      midsizeExamples: [],
      fullsizeExamples: []
    };

    let count = 0;
    for await (const blob of containerClient.listBlobsFlat()) {
      count++;
      
      if (blob.name.includes('-midsize.')) {
        blobSamples.midsizeCount++;
        if (blobSamples.midsizeExamples.length < 10) {
          blobSamples.midsizeExamples.push(blob.name);
        }
      } else if (blob.name.match(/\.(jpg|jpeg|png|gif|mp4|mov)$/i)) {
        blobSamples.fullsizeCount++;
        if (blobSamples.fullsizeExamples.length < 10) {
          blobSamples.fullsizeExamples.push(blob.name);
        }
      }

      if (blob.name.startsWith('media/')) blobSamples.withMediaPrefix++;
      else blobSamples.withoutMediaPrefix++;

      if (blob.name.includes('\\')) blobSamples.backslashPaths++;
      if (blob.name.includes('/')) blobSamples.forwardSlashPaths++;

      // Limit sampling to first 10000 blobs for performance
      if (count >= 10000) break;
    }

    console.log(`📦 Blob Storage Statistics (sampled ${count} blobs):`);
    console.log(`  Midsize images: ${blobSamples.midsizeCount}`);
    console.log(`  Full-size images: ${blobSamples.fullsizeCount}`);
    console.log(`  With 'media/' prefix: ${blobSamples.withMediaPrefix}`);
    console.log(`  Without 'media/' prefix: ${blobSamples.withoutMediaPrefix}`);
    console.log(`  Paths with backslashes: ${blobSamples.backslashPaths}`);
    console.log(`  Paths with forward slashes: ${blobSamples.forwardSlashPaths}`);

    console.log('\n📝 Sample Midsize Blob Paths:');
    for (const example of blobSamples.midsizeExamples) {
      console.log(`  ${example}`);
    }

    console.log('\n📝 Sample Full-size Blob Paths:');
    for (const example of blobSamples.fullsizeExamples) {
      console.log(`  ${example}`);
    }

    // Cross-reference: Check if some database midsize URLs point to non-existent blobs
    console.log('\n' + '='.repeat(80));
    console.log('CROSS-REFERENCE CHECK');
    console.log('='.repeat(80));

    const checkSample = await pool.request().query(`
      SELECT TOP 20
        PFileName,
        PFileDirectory,
        PMidsizeUrl
      FROM Pictures
      WHERE PMidsizeUrl IS NOT NULL
      ORDER BY NEWID()
    `);

    console.log('\n🔗 Checking if database midsize URLs correspond to actual blobs...\n');

    let existCount = 0;
    let missingCount = 0;

    for (const img of checkSample.recordset) {
      // Extract path from URL: /api/media/{path} -> media/{path}
      const urlPath = img.PMidsizeUrl.replace('/api/media/', 'media/');
      const blobClient = containerClient.getBlobClient(urlPath);
      const exists = await blobClient.exists();
      
      if (exists) {
        existCount++;
        console.log(`✅ ${img.PFileName}`);
        console.log(`   URL: ${img.PMidsizeUrl}`);
        console.log(`   Blob: ${urlPath}`);
      } else {
        missingCount++;
        console.log(`❌ ${img.PFileName}`);
        console.log(`   URL: ${img.PMidsizeUrl}`);
        console.log(`   Expected blob: ${urlPath}`);
        
        // Try alternative paths
        const alternatives = [
          urlPath.replace(/\//g, '\\'),
          urlPath.replace('media/', ''),
          img.PFileDirectory.replace(/\\/g, '/') + '/' + img.PFileName.split('/').pop().split('\\').pop().replace(/\.(jpg|jpeg|png)/i, '-midsize.$1')
        ];
        
        for (const alt of alternatives) {
          const altClient = containerClient.getBlobClient(alt);
          if (await altClient.exists()) {
            console.log(`   ✅ Found at: ${alt}`);
            break;
          }
        }
      }
      console.log('');
    }

    console.log('\n📊 Cross-reference Results:');
    console.log(`  Blobs found: ${existCount}/${checkSample.recordset.length}`);
    console.log(`  Blobs missing: ${missingCount}/${checkSample.recordset.length}`);

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log('\n✅ Analysis complete!');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    if (pool) await pool.close();
  }
}

wholisticPathCheck();
