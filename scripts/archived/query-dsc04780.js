const https = require('https');

const url = 'https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media?filename=Events%2fWhistler%2fDSC04780%20%281%29.JPG';

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const dsc = json.find(item => item.PFileName && item.PFileName.includes('DSC04780'));
      
      if (dsc) {
        console.log('=== DSC04780 Information ===');
        console.log('File:', dsc.PFileName);
        console.log('PPeopleList:', dsc.PPeopleList);
        console.log('\nTaggedPeople:');
        if (dsc.TaggedPeople && dsc.TaggedPeople.length > 0) {
          dsc.TaggedPeople.forEach((p, i) => {
            console.log(`  ${i + 1}. ID: ${p.ID}, Name: ${p.neName}`);
          });
        } else {
          console.log('  (empty)');
        }
        console.log('\nEvent:', dsc.Event ? `${dsc.Event.neName} (ID: ${dsc.Event.ID})` : '(none)');
      } else {
        console.log('File not found');
      }
    } catch (e) {
      console.error('Error parsing response:', e.message);
    }
    process.exit(0);
  });
}).on('error', (e) => {
  console.error('Error fetching URL:', e.message);
  process.exit(1);
});
