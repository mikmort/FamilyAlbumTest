const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Load from local.settings.json
const localSettings = JSON.parse(fs.readFileSync(path.join(__dirname, '../api/local.settings.json'), 'utf8'));
const values = localSettings.Values;

const config = {
  server: values.AZURE_SQL_SERVER,
  database: values.AZURE_SQL_DATABASE,
  user: values.AZURE_SQL_USER,
  password: values.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function clearAllMidsizeUrls() {
  try {
    console.log('Connecting to database...');
    await sql.connect(config);
    console.log('Connected!\n');

    // First, count how many will be cleared
    const countResult = await sql.query`
      SELECT COUNT(*) as count
      FROM Pictures
      WHERE PMidsizeUrl IS NOT NULL
    `;

    const count = countResult.recordset[0].count;
    console.log(`Found ${count} images with PMidsizeUrl set\n`);

    if (count === 0) {
      console.log('No PMidsizeUrl entries to clear.');
      return;
    }

    console.log('WARNING: This will clear ALL PMidsizeUrl entries.');
    console.log('The generate-midsize script will recreate them for images >1MB.\n');

    // Clear all PMidsizeUrl entries
    console.log('Clearing all PMidsizeUrl entries...');
    const result = await sql.query`
      UPDATE Pictures
      SET PMidsizeUrl = NULL,
          PLastModifiedDate = GETDATE()
      WHERE PMidsizeUrl IS NOT NULL
    `;

    console.log(`✅ Cleared PMidsizeUrl for ${count} images!`);
    console.log('\nNext steps:');
    console.log('1. Go to Admin Settings');
    console.log('2. Click "Fix All Missing Midsize Images"');
    console.log('3. The script will regenerate midsize images for all large files (>1MB)');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.close();
  }
}

clearAllMidsizeUrls();
