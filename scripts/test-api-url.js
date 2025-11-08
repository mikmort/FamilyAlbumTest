// Test the API media endpoint for MVI_5732.mp4
const http = require('http');

const filename = 'Events/ES BnotMitzvah/MVI_5732.mp4';
// Encode each path segment
const encodedFilename = filename.split('/').map(encodeURIComponent).join('/');
const url = `/api/media/${encodedFilename}`;

console.log(`\n📡 Testing API endpoint:`);
console.log(`   Original: ${filename}`);
console.log(`   Encoded: ${encodedFilename}`);
console.log(`   URL: ${url}`);
console.log(`\n   Full URL: http://localhost:7071${url}`);
console.log(`\n⚠️  Note: Make sure the API is running locally with 'func start' in the /api directory`);
console.log(`   Or test against production: https://familyalbum-prod-app.azurestaticapps.net${url}\n`);
