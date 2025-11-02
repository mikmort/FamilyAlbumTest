const https = require('https');

// Get people list to check the missing IDs
const missingIds = [553, 551, 552];
const allIds = [195, 553, 318, 551, 507, 281, 462, 425, 552];

const url = `https://lively-glacier-02a77180f.2.azurestaticapps.net/api/people`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const peopleMap = {};
      json.forEach(p => { peopleMap[p.ID] = p; });
      
      console.log('=== Missing IDs Analysis ===');
      missingIds.forEach(id => {
        const person = peopleMap[id];
        if (person) {
          console.log(`ID ${id}: ${person.neName} (neType: ${person.neRelation || 'N/A'})`);
        } else {
          console.log(`ID ${id}: NOT FOUND in people list (likely an EVENT)`);
        }
      });
      
      console.log('\n=== All IDs in PPeopleList ===');
      allIds.forEach(id => {
        const person = peopleMap[id];
        console.log(`ID ${id}: ${person ? person.neName : '(NOT IN PEOPLE)'}`);
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
