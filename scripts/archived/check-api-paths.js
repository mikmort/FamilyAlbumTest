// Check what paths the API is returning
const https = require('https');

// Your Azure Static Web App URL
const apiUrl = 'https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media';

async function checkPaths() {
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        console.log('\n=== Media Items with "Devorah" or "Wedding" ===\n');
        
        const filtered = data.filter(item => 
            item.PFileName?.toLowerCase().includes('devorah') ||
            item.PFileName?.toLowerCase().includes('wedding') ||
            item.PFileDirectory?.toLowerCase().includes('devorah') ||
            item.PFileDirectory?.toLowerCase().includes('wedding')
        );
        
        filtered.slice(0, 10).forEach(item => {
            console.log('PFileName:', item.PFileName);
            console.log('PFileDirectory:', item.PFileDirectory);
            console.log('PBlobUrl:', item.PBlobUrl);
            console.log('Date:', item.PMonth ? `${item.PMonth}/${item.PYear}` : 'Unknown');
            console.log('---');
        });
        
        console.log(`\nShowing first 10 of ${filtered.length} matching items`);
        
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkPaths();
