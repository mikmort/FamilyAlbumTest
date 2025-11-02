/**
 * Convert MPG files in blob storage to MP4 format
 * Similar to MOV conversion but for MPEG files
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

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

// Helper function to safely delete file with retry
async function safeUnlink(filePath, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(filePath)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        fs.unlinkSync(filePath);
      }
      return;
    } catch (err) {
      if (i === maxRetries - 1) {
        console.log(`   ⚠️  Warning: Could not delete ${path.basename(filePath)} (${err.code})`);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

async function convertMPGtoMP4(mpgBlob, retryCount = 0) {
  const fileName = path.basename(mpgBlob);
  const mp4Name = fileName.replace(/\.(mpg|mpeg)$/i, '.mp4');
  const mp4BlobName = mpgBlob.replace(/\.(mpg|mpeg)$/i, '.mp4');
  
  console.log(`\n🎬 Converting: ${mpgBlob}`);
  
  // Check if MP4 already exists
  try {
    const mp4Client = containerClient.getBlobClient(mp4BlobName);
    const exists = await mp4Client.exists();
    if (exists) {
      console.log(`   ⏭️  MP4 already exists, skipping`);
      return { success: true, skipped: true };
    }
  } catch (err) {
    // Continue if doesn't exist
  }
  
  const tempDir = os.tmpdir();
  const tempMPG = path.join(tempDir, fileName);
  const tempMP4 = path.join(tempDir, mp4Name);
  
  try {
    // Download MPG
    console.log(`   ⬇️  Downloading...`);
    const blobClient = containerClient.getBlobClient(mpgBlob);
    
    const downloadPromise = blobClient.downloadToFile(tempMPG);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Download timeout (10 minutes)')), 10 * 60 * 1000)
    );
    
    await Promise.race([downloadPromise, timeoutPromise]);
    
    if (!fs.existsSync(tempMPG)) {
      throw new Error('Download failed - file not created');
    }
    
    // Convert to MP4
    console.log(`   🔄 Converting to MP4...`);
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', tempMPG,
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'medium',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        tempMP4
      ], {
        stdio: 'pipe'
      });
      
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const lastLines = stderr.split('\n').slice(-5).join('\n');
          reject(new Error(`FFmpeg exited with code ${code}\n${lastLines}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
    
    if (!fs.existsSync(tempMP4)) {
      throw new Error('Conversion failed - MP4 not created');
    }
    
    // Upload MP4
    console.log(`   ⬆️  Uploading MP4...`);
    const mp4Client = containerClient.getBlockBlobClient(mp4BlobName);
    await mp4Client.uploadFile(tempMP4);
    
    // Get file sizes
    const mpgSize = fs.statSync(tempMPG).size;
    const mp4Size = fs.statSync(tempMP4).size;
    const savings = ((mpgSize - mp4Size) / mpgSize * 100).toFixed(1);
    
    console.log(`   ✅ Success! ${(mpgSize / 1024 / 1024).toFixed(2)}MB → ${(mp4Size / 1024 / 1024).toFixed(2)}MB (${savings}% smaller)`);
    
    // Clean up
    await safeUnlink(tempMPG);
    await safeUnlink(tempMP4);
    
    return { success: true, skipped: false, mpgSize, mp4Size };
    
  } catch (err) {
    console.error(`   ❌ Failed: ${err.message}`);
    
    if (retryCount < 2 && (err.message.includes('aborted') || err.message.includes('timeout'))) {
      console.log(`   🔄 Retrying (attempt ${retryCount + 2}/3)...`);
      await safeUnlink(tempMPG);
      await safeUnlink(tempMP4);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return await convertMPGtoMP4(mpgBlob, retryCount + 1);
    }
    
    await safeUnlink(tempMPG);
    await safeUnlink(tempMP4);
    
    return { success: false, error: err.message, blob: mpgBlob };
  }
}

async function main() {
  try {
    console.log('=' .repeat(80));
    console.log('Convert MPG Files to MP4');
    console.log('='.repeat(80));
    console.log(`Storage: ${storageAccount}/${containerName}`);
    console.log('='.repeat(80));
    console.log('');
    
    // Find all MPG files
    console.log('🔍 Finding MPG files in blob storage...');
    const mpgFiles = [];
    
    for await (const blob of containerClient.listBlobsFlat()) {
      if (blob.name.match(/\.(mpg|mpeg)$/i) && !blob.name.startsWith('thumbnails/')) {
        mpgFiles.push(blob.name);
      }
    }
    
    console.log(`   Found ${mpgFiles.length} MPG files`);
    console.log('');
    
    if (mpgFiles.length === 0) {
      console.log('✅ No MPG files to convert');
      return;
    }
    
    // Convert each file
    let converted = 0;
    let skipped = 0;
    let failed = 0;
    let totalMpgSize = 0;
    let totalMp4Size = 0;
    const failedFiles = [];
    
    for (const mpgFile of mpgFiles) {
      const result = await convertMPGtoMP4(mpgFile);
      
      if (result.success) {
        if (result.skipped) {
          skipped++;
        } else {
          converted++;
          totalMpgSize += result.mpgSize;
          totalMp4Size += result.mp4Size;
        }
      } else {
        failed++;
        failedFiles.push({ file: result.blob, error: result.error });
      }
    }
    
    // Summary
    console.log('');
    console.log('='.repeat(80));
    console.log('CONVERSION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total MPG files:   ${mpgFiles.length}`);
    console.log(`Converted:         ${converted}`);
    console.log(`Skipped:           ${skipped}`);
    console.log(`Failed:            ${failed}`);
    
    if (converted > 0) {
      const totalSavings = ((totalMpgSize - totalMp4Size) / totalMpgSize * 100).toFixed(1);
      console.log(`Original size:     ${(totalMpgSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Converted size:    ${(totalMp4Size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Space saved:       ${totalSavings}%`);
    }
    
    if (failedFiles.length > 0) {
      console.log('');
      console.log('Failed conversions:');
      failedFiles.forEach(({ file, error }) => {
        console.log(`  ❌ ${file}`);
        console.log(`     ${error.split('\n')[0]}`);
      });
    }
    
    console.log('='.repeat(80));
    console.log('');
    
    if (failed > 0) {
      console.log('⚠️  Conversion completed with errors. You can re-run the script to retry failed files.');
    } else {
      console.log('✅ Conversion complete!');
    }
    
    console.log('');
    console.log('Next steps:');
    console.log('1. Run database update for MPG files');
    console.log('2. Execute the generated SQL script in Azure Data Studio');
    console.log('3. Run: node ../scripts/cleanup-placeholder-thumbnails.js');
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
