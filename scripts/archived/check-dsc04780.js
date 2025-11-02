const { query } = require('../api/shared/db');

async function checkFile() {
  try {
    const picturesResult = await query(
      'SELECT PFileName, PPeopleList FROM dbo.Pictures WHERE PFileName LIKE @pattern',
      { pattern: '%DSC04780%' }
    );
    
    console.log('=== Picture Record ===');
    if (picturesResult.length > 0) {
      picturesResult.forEach(row => {
        console.log('PFileName:', row.PFileName);
        console.log('PPeopleList:', row.PPeopleList);
        
        // Parse the tokens and look them up
        const tokens = (row.PPeopleList || '').split(',').map(s => s.trim()).filter(Boolean);
        console.log('Tokens in order:', tokens);
      });
    } else {
      console.log('No pictures found');
      process.exit(0);
    }
    
    // Now get the NameEvent records for those IDs
    console.log('\n=== NameEvent Lookup ===');
    const ppl = picturesResult[0]?.PPeopleList || '';
    if (ppl) {
      const nameEventResult = await query(
        `SELECT ID, neName, neType FROM dbo.NameEvent WHERE ID IN (${ppl.split(',').map(() => '?').join(',')})`,
        ppl.split(',').map(s => parseInt(s.trim()))
      );
      
      nameEventResult.forEach(row => {
        console.log(`ID: ${row.ID}, Name: ${row.neName}, Type: ${row.neType}`);
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
  process.exit(0);
}

checkFile();
