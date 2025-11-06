const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
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

async function checkTables() {
  let pool;
  try {
    pool = await sql.connect(config);
    
    console.log('Checking for face recognition tables...\n');
    
    const result = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME IN ('FaceEncodings', 'PersonEncodings')
      ORDER BY TABLE_NAME
    `);
    
    if (result.recordset.length === 0) {
      console.log('✅ No face recognition tables exist yet - ready for migration!');
    } else {
      console.log('⚠️  Found existing tables:');
      result.recordset.forEach(row => {
        console.log(`   - ${row.TABLE_NAME}`);
      });
      console.log('\nChecking if we should drop and recreate...');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

checkTables();
