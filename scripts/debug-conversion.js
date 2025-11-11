// Debug script to test converting a single failed AVI file
const { BlobServiceClient } = require('@azure/storage-blob');
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

// Test file from the failed list
const testFile = 'Events/Thanksgiving/Thanksgiving 2006/MVI_0995.AVI';

async function debugConvert() {
  console.log(`Testing conversion of: ${testFile}\n`);

  // Connect to blob storage
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Create temp directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-debug-'));
  console.log(`Temp directory: ${tempDir}\n`);

  try {
    // Download file
    const ext = path.extname(testFile);
    const inputPath = path.join(tempDir, `input${ext}`);
    const outputPath = path.join(tempDir, 'output.mp4');

    console.log('Downloading file...');
    const blobClient = containerClient.getBlobClient(testFile);
    await blobClient.downloadToFile(inputPath);
    
    const inputSize = fs.statSync(inputPath).size;
    console.log(`Downloaded: ${(inputSize / 1024 / 1024).toFixed(2)} MB\n`);

    // Try to get file info first
    console.log('Getting video info with FFprobe...');
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,codec_type,width,height',
      '-of', 'json',
      inputPath
    ]);

    let probeOutput = '';
    ffprobe.stdout.on('data', (data) => {
      probeOutput += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      console.error('FFprobe error:', data.toString());
    });

    await new Promise((resolve, reject) => {
      ffprobe.on('close', (code) => {
        if (code === 0) {
          console.log('Video info:', probeOutput);
          resolve();
        } else {
          console.error(`FFprobe exited with code ${code}`);
          resolve(); // Continue anyway
        }
      });
    });

    // Try conversion with verbose output
    console.log('\nAttempting conversion...');
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

    ffmpeg.stdout.on('data', (data) => {
      console.log('FFmpeg:', data.toString());
    });

    ffmpeg.stderr.on('data', (data) => {
      console.log('FFmpeg:', data.toString());
    });

    const exitCode = await new Promise((resolve) => {
      ffmpeg.on('close', resolve);
    });

    if (exitCode === 0) {
      const outputSize = fs.statSync(outputPath).size;
      console.log(`\n✓ SUCCESS! Converted: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Output file: ${outputPath}`);
    } else {
      console.error(`\n✗ FAILED! FFmpeg exited with code ${exitCode}`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    // Clean up
    console.log(`\nTemp files in: ${tempDir}`);
    console.log('(Not deleted for inspection)');
  }
}

debugConvert().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
