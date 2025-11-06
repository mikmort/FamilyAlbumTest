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

async function cleanupTables() {
  let pool;
  try {
    pool = await sql.connect(config);
    
    console.log('🧹 Cleaning up partially created face recognition tables...\n');
    
    // Drop tables in correct order (child first)
    console.log('Dropping FaceEncodings table...');
    await pool.request().query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FaceEncodings')
      BEGIN
        DROP TABLE dbo.FaceEncodings;
        PRINT 'FaceEncodings table dropped';
      END
      ELSE
      BEGIN
        PRINT 'FaceEncodings table does not exist';
      END
    `);
    
    console.log('Dropping PersonEncodings table...');
    await pool.request().query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PersonEncodings')
      BEGIN
        DROP TABLE dbo.PersonEncodings;
        PRINT 'PersonEncodings table dropped';
      END
      ELSE
      BEGIN
        PRINT 'PersonEncodings table does not exist';
      END
    `);
    
    console.log('\n✅ Cleanup complete. Ready to run migration again.');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

cleanupTables();
