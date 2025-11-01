const { query } = require('../api/shared/db');

async function checkMOVFiles() {
  try {
    const results = await query(
      `SELECT PFileName, PCategory 
       FROM Pictures 
       WHERE PCategory LIKE '%Thanksgiving%' 
       AND (PFileName LIKE '%.MOV' OR PFileName LIKE '%.mov')
       ORDER BY PCategory, PFileName`
    );
    
    console.log(`Found ${results.length} MOV files in Thanksgiving folders:\n`);
    results.forEach(r => {
      console.log(`${r.PCategory}/${r.PFileName}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkMOVFiles();
