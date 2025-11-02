/**
 * Convert MOV files already in blob storage to MP4 format
 * This script downloads MOV files, converts them to MP4, and uploads the MP4 versions
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
        // Wait a bit to ensure file handles are released
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

async function convertMOVtoMP4(movBlob, retryCount = 0) {
  const fileName = path.basename(movBlob);
  const mp4Name = fileName.replace(/\.MOV$/i, '.mp4');
  const mp4BlobName = movBlob.replace(/\.MOV$/i, '.mp4');
  
  console.log(`\n🎬 Converting: ${movBlob}`);
  
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
  const tempMOV = path.join(tempDir, fileName);
  const tempMP4 = path.join(tempDir, mp4Name);
  
  try {
    // Download MOV with timeout
    console.log(`   ⬇️  Downloading...`);
    const blobClient = containerClient.getBlobClient(movBlob);
    
    // Add timeout to download
    const downloadPromise = blobClient.downloadToFile(tempMOV);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Download timeout (10 minutes)')), 10 * 60 * 1000)
    );
    
    await Promise.race([downloadPromise, timeoutPromise]);
    
    // Verify download completed
    if (!fs.existsSync(tempMOV)) {
      throw new Error('Download failed - file not created');
    }
    
    // Convert to MP4
    console.log(`   🔄 Converting to MP4...`);
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', tempMOV,
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'medium',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        tempMP4
      ], {
        stdio: 'pipe' // Suppress FFmpeg output
      });
      
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Log last few lines of FFmpeg error
          const lastLines = stderr.split('\n').slice(-5).join('\n');
          reject(new Error(`FFmpeg exited with code ${code}\n${lastLines}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
    
    // Verify conversion completed
    if (!fs.existsSync(tempMP4)) {
      throw new Error('Conversion failed - MP4 not created');
    }
    
    // Upload MP4
    console.log(`   ⬆️  Uploading MP4...`);
    const mp4Client = containerClient.getBlockBlobClient(mp4BlobName);
    await mp4Client.uploadFile(tempMP4);
    
    // Get file sizes
    const movSize = fs.statSync(tempMOV).size;
    const mp4Size = fs.statSync(tempMP4).size;
    const savings = ((movSize - mp4Size) / movSize * 100).toFixed(1);
    
    console.log(`   ✅ Success! ${(movSize / 1024 / 1024).toFixed(2)}MB → ${(mp4Size / 1024 / 1024).toFixed(2)}MB (${savings}% smaller)`);
    
    // Clean up with retry logic
    await safeUnlink(tempMOV);
    await safeUnlink(tempMP4);
    
    return { success: true, skipped: false, movSize, mp4Size };
    
  } catch (err) {
    console.error(`   ❌ Failed: ${err.message}`);
    
    // Retry logic for network errors
    if (retryCount < 2 && (err.message.includes('aborted') || err.message.includes('timeout'))) {
      console.log(`   🔄 Retrying (attempt ${retryCount + 2}/3)...`);
      await safeUnlink(tempMOV);
      await safeUnlink(tempMP4);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      return await convertMOVtoMP4(movBlob, retryCount + 1);
    }
    
    // Clean up on error
    await safeUnlink(tempMOV);
    await safeUnlink(tempMP4);
    
    return { success: false, error: err.message, blob: movBlob };
  }
}

async function main() {
  console.log('=' .repeat(80));
  console.log('Convert MOV Files to MP4');
  console.log('='.repeat(80));
  console.log(`Storage: ${storageAccount}/${containerName}`);
  console.log('='.repeat(80));
  console.log('');
  
  // Find all MOV files
  console.log('🔍 Finding MOV files in blob storage...');
  const movFiles = [];
  
  for await (const blob of containerClient.listBlobsFlat()) {
    if (blob.name.match(/\.MOV$/i)) {
      movFiles.push(blob.name);
    }
  }
  
  console.log(`   Found ${movFiles.length} MOV files`);
  console.log('');
  
  if (movFiles.length === 0) {
    console.log('✅ No MOV files to convert');
    return;
  }
  
  // Convert each file
  let converted = 0;
  let skipped = 0;
  let failed = 0;
  let totalMovSize = 0;
  let totalMp4Size = 0;
  const failedFiles = [];
  
  for (const movFile of movFiles) {
    const result = await convertMOVtoMP4(movFile);
    
    if (result.success) {
      if (result.skipped) {
        skipped++;
      } else {
        converted++;
        totalMovSize += result.movSize;
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
  console.log(`Total MOV files:   ${movFiles.length}`);
  console.log(`Converted:         ${converted}`);
  console.log(`Skipped:           ${skipped}`);
  console.log(`Failed:            ${failed}`);
  
  if (converted > 0) {
    const totalSavings = ((totalMovSize - totalMp4Size) / totalMovSize * 100).toFixed(1);
    console.log(`Original size:     ${(totalMovSize / 1024 / 1024).toFixed(2)} MB`);
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
  console.log('1. Run: node ../scripts/update-database-after-conversion.js');
  console.log('2. Execute the generated SQL script in Azure Data Studio');
  console.log('3. Run: node ../scripts/cleanup-placeholder-thumbnails.js');
}

main().catch(console.error);
