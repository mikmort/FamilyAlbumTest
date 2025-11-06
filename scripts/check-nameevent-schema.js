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

async function checkSchema() {
  let pool;
  try {
    pool = await sql.connect(config);
    
    console.log('Checking NameEvent table schema...\n');
    const result = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'NameEvent'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('NameEvent table columns:');
    result.recordset.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('\nChecking for NameID index/constraint...');
    const indexResult = await pool.request().query(`
      SELECT 
        i.name as IndexName,
        i.is_primary_key,
        i.is_unique,
        COL_NAME(ic.object_id, ic.column_id) as ColumnName
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      WHERE i.object_id = OBJECT_ID('dbo.NameEvent')
        AND COL_NAME(ic.object_id, ic.column_id) = 'NameID'
    `);
    
    if (indexResult.recordset.length > 0) {
      console.log('Found indexes on NameID:');
      indexResult.recordset.forEach(idx => {
        console.log(`  ${idx.IndexName} ${idx.is_primary_key ? '(PRIMARY KEY)' : ''} ${idx.is_unique ? '(UNIQUE)' : ''}`);
      });
    } else {
      console.log('⚠️  No index found on NameID - this might be the issue!');
    }
    
    console.log('\nChecking existing foreign keys to NameEvent...');
    const fkResult = await pool.request().query(`
      SELECT 
        fk.name as ForeignKeyName,
        OBJECT_NAME(fk.parent_object_id) as TableName,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) as ColumnName
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      WHERE fk.referenced_object_id = OBJECT_ID('dbo.NameEvent')
    `);
    
    if (fkResult.recordset.length > 0) {
      console.log('Existing foreign keys referencing NameEvent:');
      fkResult.recordset.forEach(fk => {
        console.log(`  ${fk.TableName}.${fk.ColumnName} -> ${fk.ForeignKeyName}`);
      });
    } else {
      console.log('No existing foreign keys reference NameEvent');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

checkSchema();
