// Check which files were successfully converted to MP4
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../api/local.settings.json'), 'utf8'));
const config = {
  server: settings.Values.AZURE_SQL_SERVER,
  database: settings.Values.AZURE_SQL_DATABASE,
  user: settings.Values.AZURE_SQL_USER,
  password: settings.Values.AZURE_SQL_PASSWORD,
  options: { encrypt: true }
};

async function checkConversions() {
  const pool = await sql.connect(config);
  
  // Check non-thumbnail MP4 files
  const result = await pool.request().query(`
    SELECT PFileName 
    FROM Pictures 
    WHERE PFileName LIKE '%.mp4' 
      AND PFileName NOT LIKE 'thumbnails/%'
      AND PFileName NOT LIKE 'media/%'
    ORDER BY PFileName
  `);
  
  console.log('\n=== Successfully Converted Media Files ===');
  console.log(`Total: ${result.recordset.length} MP4 files\n`);
  result.recordset.forEach(r => console.log(`  ✓ ${r.PFileName}`));
  
  // Check if any AVI/MOV files remain
  const remainingResult = await pool.request().query(`
    SELECT PFileName 
    FROM Pictures 
    WHERE (PFileName LIKE '%.avi' OR PFileName LIKE '%.AVI' OR PFileName LIKE '%.mov' OR PFileName LIKE '%.MOV')
      AND PFileName NOT LIKE 'thumbnails/%'
      AND PFileName NOT LIKE 'media/%'
    ORDER BY PFileName
  `);
  
  console.log('\n=== Remaining AVI/MOV Files ===');
  console.log(`Total: ${remainingResult.recordset.length} files\n`);
  remainingResult.recordset.forEach(r => console.log(`  ⚠️  ${r.PFileName}`));
  
  await pool.close();
}

checkConversions().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
