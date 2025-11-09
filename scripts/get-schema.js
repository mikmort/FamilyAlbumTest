// Script to get the actual database schema from Azure SQL
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Try to load from environment variables first (used by GitHub Copilot coding agent)
// Fall back to local.settings.json for local development
let server, database, user, password;

if (process.env.AZURE_SQL_SERVER) {
  // Using environment variables (GitHub secrets)
  server = process.env.AZURE_SQL_SERVER;
  database = process.env.AZURE_SQL_DATABASE;
  user = process.env.AZURE_SQL_USER;
  password = process.env.AZURE_SQL_PASSWORD;
  console.log('Using database credentials from environment variables');
} else {
  // Using local.settings.json
  const localSettings = JSON.parse(fs.readFileSync(path.join(__dirname, '../api/local.settings.json'), 'utf8'));
  const values = localSettings.Values;
  server = values.AZURE_SQL_SERVER;
  database = values.AZURE_SQL_DATABASE;
  user = values.AZURE_SQL_USER;
  password = values.AZURE_SQL_PASSWORD;
  console.log('Using database credentials from local.settings.json');
}

const config = {
  server,
  database,
  user,
  password,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

async function getSchema() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    // Get all tables
    const tablesResult = await sql.query`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' 
      ORDER BY TABLE_NAME
    `;

    console.log('=== DATABASE SCHEMA ===\n');

    // For each table, get columns
    for (const table of tablesResult.recordset) {
      const tableName = table.TABLE_NAME;
      console.log(`\nTable: ${tableName}`);
      console.log('='.repeat(60));

      const columnsResult = await sql.query`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          CHARACTER_MAXIMUM_LENGTH,
          IS_NULLABLE,
          COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ${tableName}
        ORDER BY ORDINAL_POSITION
      `;

      for (const col of columnsResult.recordset) {
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        const maxLen = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : col.CHARACTER_MAXIMUM_LENGTH})` : '';
        const defaultVal = col.COLUMN_DEFAULT ? ` DEFAULT ${col.COLUMN_DEFAULT}` : '';
        console.log(`  ${col.COLUMN_NAME.padEnd(30)} ${col.DATA_TYPE}${maxLen.padEnd(10)} ${nullable}${defaultVal}`);
      }

      // Get indexes
      const indexesResult = await sql.query`
        SELECT 
          i.name AS IndexName,
          i.type_desc AS IndexType,
          STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS Columns
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        WHERE t.name = ${tableName}
          AND i.is_primary_key = 0
          AND i.type > 0
        GROUP BY i.name, i.type_desc
      `;

      if (indexesResult.recordset.length > 0) {
        console.log('\n  Indexes:');
        for (const idx of indexesResult.recordset) {
          console.log(`    ${idx.IndexName}: ${idx.Columns} (${idx.IndexType})`);
        }
      }

      // Get foreign keys
      const fkResult = await sql.query`
        SELECT 
          fk.name AS ForeignKeyName,
          c.name AS ColumnName,
          rt.name AS ReferencedTable,
          rc.name AS ReferencedColumn
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        INNER JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
        INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
        INNER JOIN sys.tables rt ON fk.referenced_object_id = rt.object_id
        INNER JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
        WHERE t.name = ${tableName}
      `;

      if (fkResult.recordset.length > 0) {
        console.log('\n  Foreign Keys:');
        for (const fk of fkResult.recordset) {
          console.log(`    ${fk.ForeignKeyName}: ${fk.ColumnName} -> ${fk.ReferencedTable}(${fk.ReferencedColumn})`);
        }
      }
    }

    console.log('\n\n=== SCHEMA EXPORT COMPLETE ===\n');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.close();
  }
}

getSchema();
