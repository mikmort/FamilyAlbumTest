const https = require('https');

// Files to delete
const filesToDelete = [
  'V__E425.jpg',
  'V__E425.jpg',
  'V__E425.jpg',
  'MVI_5258.MOV',
  'MVI_5292.MOV'
];

console.log('Deleting files with bad blob URLs...\n');

async function deleteFile(filename) {
  return new Promise((resolve, reject) => {
    // First, get the list to find the uiID
    https.get('https://lively-glacier-02a77180f.2.azurestaticapps.net/api/unindexed/list', (res) => {
      let data = '';
      res.on('data', (d) => data += d);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const file = result.files.find(f => f.uiFileName === filename);
          
          if (!file) {
            console.log(`❌ File not found: ${filename}`);
            resolve();
            return;
          }

          console.log(`Found ${filename} with ID ${file.uiID}, deleting...`);

          // Delete the file
          const deleteReq = https.request(
            `https://lively-glacier-02a77180f.2.azurestaticapps.net/api/unindexed/${file.uiID}`,
            {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' }
            },
            (deleteRes) => {
              let deleteData = '';
              deleteRes.on('data', (d) => deleteData += d);
              deleteRes.on('end', () => {
                if (deleteRes.statusCode === 200) {
                  console.log(`✅ Deleted: ${filename}`);
                } else {
                  console.log(`❌ Failed to delete ${filename}: ${deleteRes.statusCode}`);
                  console.log(deleteData);
                }
                resolve();
              });
            }
          );

          deleteReq.on('error', (e) => {
            console.error(`❌ Error deleting ${filename}:`, e);
            resolve();
          });

          deleteReq.end();

        } catch (e) {
          console.error('Parse error:', e);
          reject(e);
        }
      });
    }).on('error', (e) => {
      console.error('Error:', e);
      reject(e);
    });
  });
}

(async () => {
  // Delete files one by one
  for (const filename of filesToDelete) {
    await deleteFile(filename);
    // Wait a bit between deletions
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n✅ Done! You can now re-upload the files.');
})();
