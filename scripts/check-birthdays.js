const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local or use env vars directly
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Also check api/local.settings.json as fallback
const apiSettingsPath = path.join(__dirname, '..', 'api', 'local.settings.json');
if (fs.existsSync(apiSettingsPath)) {
  const settings = JSON.parse(fs.readFileSync(apiSettingsPath, 'utf8'));
  if (settings.Values) {
    Object.keys(settings.Values).forEach(key => {
      if (!process.env[key]) {
        process.env[key] = settings.Values[key];
      }
    });
  }
}

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

async function checkBirthdays() {
  if (!config.server || !config.database) {
    console.log('❌ Database credentials not configured');
    console.log('   Please set AZURE_SQL_* environment variables or create api/local.settings.json');
    return;
  }

  let pool;
  try {
    console.log('Connecting to database...');
    pool = await sql.connect(config);
    
    // First, check the actual schema of NameEvent table
    console.log('\n=== NameEvent Table Schema ===');
    const schemaResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'NameEvent'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Columns:');
    schemaResult.recordset.forEach(col => {
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      const def = col.COLUMN_DEFAULT ? ` DEFAULT ${col.COLUMN_DEFAULT}` : '';
      console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length} ${nullable}${def}`);
    });
    
    // Check for birthday-related events
    console.log('\n=== Birthday-Related Events ===');
    const eventsResult = await pool.request().query(`
      SELECT 
        ID,
        neName,
        neRelation,
        neType,
        neCount
      FROM NameEvent
      WHERE neType = 'E' 
        AND (
          neName LIKE '%Birthday%' 
          OR neName LIKE '%birthday%'
          OR neName LIKE '%Bday%'
          OR neName LIKE '%B-day%'
        )
      ORDER BY neName
    `);
    
    console.log(`Found ${eventsResult.recordset.length} birthday-related events:`);
    eventsResult.recordset.forEach(event => {
      console.log(`  ID: ${event.ID}, Name: "${event.neName}", Relation: "${event.neRelation || 'N/A'}", Count: ${event.neCount}`);
    });
    
    // Check for all people
    console.log('\n=== All People ===');
    const peopleResult = await pool.request().query(`
      SELECT 
        ID,
        neName,
        neRelation,
        neCount
      FROM NameEvent
      WHERE neType = 'N'
      ORDER BY neName
    `);
    
    console.log(`Found ${peopleResult.recordset.length} people:`);
    peopleResult.recordset.forEach(person => {
      console.log(`  ID: ${person.ID}, Name: "${person.neName}", Relation: "${person.neRelation || 'N/A'}", Count: ${person.neCount}`);
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('Login failed') || error.message.includes('Cannot open database')) {
      console.log('\n💡 Tip: Check your database credentials in .env.local or api/local.settings.json');
    }
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

checkBirthdays();
