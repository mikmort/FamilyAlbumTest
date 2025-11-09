// Run database schema migration for InsightFace support
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const config = {
    server: process.env.AZURE_SQL_SERVER || 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net',
    database: process.env.AZURE_SQL_DATABASE || 'FamilyAlbum',
    user: process.env.AZURE_SQL_USER || 'familyadmin',
    password: process.env.AZURE_SQL_PASSWORD || 'Jam3jam3!',
    options: {
      encrypt: true,
      trustServerCertificate: false
    }
  };

  console.log('Connecting to database...');
  console.log(`Server: ${config.server}`);
  console.log(`Database: ${config.database}`);
  
  try {
    await sql.connect(config);
    console.log('✓ Connected to database');

    // Read migration script
    const migrationPath = path.join(__dirname, '..', 'database', 'add-embedding-model-version.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('\nRunning migration script...');
    console.log('─'.repeat(60));
    
    // Split by GO statements and execute each batch
    const batches = migrationSQL.split(/^\s*GO\s*$/im).filter(batch => batch.trim());
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        console.log(`\nExecuting batch ${i + 1}/${batches.length}...`);
        try {
          const result = await sql.query(batch);
          if (result.rowsAffected && result.rowsAffected.length > 0) {
            console.log(`✓ Rows affected: ${result.rowsAffected.join(', ')}`);
          } else {
            console.log('✓ Executed successfully');
          }
          
          // Print any messages (PRINT statements)
          if (result.output) {
            console.log(result.output);
          }
        } catch (batchError) {
          // Check if error is "column already exists" - that's OK
          if (batchError.message.includes('already an object') || 
              batchError.message.includes('already exists') ||
              batchError.message.includes('Column names in each table must be unique')) {
            console.log(`⚠ Skipping: ${batchError.message.split('\n')[0]}`);
          } else {
            throw batchError;
          }
        }
      }
    }
    
    console.log('\n' + '─'.repeat(60));
    console.log('✅ Migration completed successfully!');
    
    // Verify the changes
    console.log('\nVerifying schema changes...');
    const verify = await sql.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'FaceEmbeddings'
      AND COLUMN_NAME IN ('ModelVersion', 'EmbeddingDimensions')
      ORDER BY COLUMN_NAME
    `);
    
    if (verify.recordset.length === 2) {
      console.log('✓ New columns found:');
      verify.recordset.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''} ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    } else {
      console.log('⚠ Warning: Expected 2 columns, found', verify.recordset.length);
    }
    
    // Check existing embeddings
    const stats = await sql.query(`
      SELECT 
        ModelVersion,
        EmbeddingDimensions,
        COUNT(*) as Count
      FROM FaceEmbeddings
      GROUP BY ModelVersion, EmbeddingDimensions
      ORDER BY ModelVersion
    `);
    
    console.log('\nCurrent embeddings in database:');
    if (stats.recordset.length > 0) {
      stats.recordset.forEach(row => {
        console.log(`  - ${row.ModelVersion || 'NULL'} (${row.EmbeddingDimensions || 'NULL'}-dim): ${row.Count} embeddings`);
      });
    } else {
      console.log('  (no embeddings yet)');
    }
    
    await sql.close();
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error('\nFull error:', err);
    process.exit(1);
  }
}

runMigration();
