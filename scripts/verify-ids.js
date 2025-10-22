const https = require('https');

const url = 'https://lively-glacier-02a77180f.2.azurestaticapps.net/api/people';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      
      // IDs we're looking for in DSC04780
      const targetIds = [195, 553, 318, 551, 507, 281, 462, 425, 552];
      
      console.log('=== Looking up IDs from PPeopleList ===');
      targetIds.forEach(id => {
        const person = json.find(p => p.ID === id);
        if (person) {
          console.log(`✓ ID ${id}: ${person.neName}`);
        } else {
          console.log(`✗ ID ${id}: NOT FOUND`);
        }
      });
      
      console.log('\n=== Sample of all people in database ===');
      json.slice(0, 20).forEach(p => {
        console.log(`  ID ${p.ID}: ${p.neName}`);
      });
      
      console.log(`\n... Total people: ${json.length}`);
    } catch (e) {
      console.error('Error:', e.message);
    }
    process.exit(0);
  });
}).on('error', (e) => {
  console.error('Error fetching URL:', e.message);
  process.exit(1);
});
