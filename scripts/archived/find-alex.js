const https = require('https');

const url = 'https://lively-glacier-02a77180f.2.azurestaticapps.net/api/people';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      
      console.log('=== Looking for AlexWeisberg ===');
      const alex = json.filter(p => p.neName && p.neName.toLowerCase().includes('alex') && p.neName.toLowerCase().includes('weis'));
      alex.forEach(p => {
        console.log(`  ID ${p.ID}: ${p.neName}`);
      });
      
      console.log('\n=== All people with "Alex" in name ===');
      const allAlex = json.filter(p => p.neName && p.neName.toLowerCase().includes('alex'));
      allAlex.forEach(p => {
        console.log(`  ID ${p.ID}: ${p.neName}`);
      });
      
    } catch (e) {
      console.error('Error:', e.message);
    }
    process.exit(0);
  });
}).on('error', (e) => {
  console.error('Error fetching URL:', e.message);
  process.exit(1);
});
