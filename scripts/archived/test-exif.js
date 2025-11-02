const sharp = require('sharp');
const exifReader = require('exif-reader');
const fs = require('fs');

async function testExif(imagePath) {
  try {
    console.log('Testing EXIF extraction for:', imagePath);
    
    const buffer = fs.readFileSync(imagePath);
    const metadata = await sharp(buffer).metadata();
    
    console.log('\n=== Metadata ===');
    console.log('Width:', metadata.width);
    console.log('Height:', metadata.height);
    console.log('Format:', metadata.format);
    console.log('Has EXIF:', !!metadata.exif);
    console.log('Has XMP:', !!metadata.xmp);
    console.log('Has IPTC:', !!metadata.iptc);
    
    if (metadata.exif) {
      console.log('\n=== Parsing EXIF ===');
      const exifData = exifReader(metadata.exif);
      console.log(JSON.stringify(exifData, null, 2));
      
      console.log('\n=== Date Fields ===');
      console.log('DateTimeOriginal:', exifData?.exif?.DateTimeOriginal);
      console.log('CreateDate:', exifData?.exif?.CreateDate);
      console.log('DateTime:', exifData?.image?.DateTime);
    } else {
      console.log('No EXIF data found');
    }
    
    if (metadata.xmp) {
      console.log('\n=== XMP Data ===');
      console.log(metadata.xmp.toString());
    }
    
    // Try to get file stats as fallback
    const stats = fs.statSync(imagePath);
    console.log('\n=== File System Dates (Fallback) ===');
    console.log('File Created:', stats.birthtime);
    console.log('File Modified:', stats.mtime);
  } catch (err) {
    console.error('Error:', err);
  }
}

// Test with your image
const imagePath = process.argv[2] || 'C:\\Users\\jb_mo\\OneDrive\\Pictures\\V__E425.jpg';
testExif(imagePath);
