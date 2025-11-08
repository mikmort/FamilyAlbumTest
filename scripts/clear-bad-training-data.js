const sql = require('mssql');
const config = require('../api/local.settings.json').Values;

async function clearBadTrainingData() {
  try {
    const pool = await sql.connect({
      server: config.AZURE_SQL_SERVER,
      database: config.AZURE_SQL_DATABASE,
      user: config.AZURE_SQL_USER,
      password: config.AZURE_SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false }
    });
    console.log('Connected to database\n');

    // Get counts before deletion
    const adamBefore = await pool.request().query`
      SELECT COUNT(*) as count 
      FROM FaceEmbeddings 
      WHERE PersonID = (SELECT ID FROM NameEvent WHERE neName = 'Adam Hodges')
    `;
    
    const amyBefore = await pool.request().query`
      SELECT COUNT(*) as count 
      FROM FaceEmbeddings 
      WHERE PersonID = (SELECT ID FROM NameEvent WHERE neName = 'Amy Lynn Hodges (Morton)')
    `;

    console.log('📊 Current embeddings:');
    console.log(`  Adam Hodges: ${adamBefore.recordset[0].count}`);
    console.log(`  Amy Lynn Hodges (Morton): ${amyBefore.recordset[0].count}`);
    console.log('');

    // Delete Adam's embeddings
    console.log('🗑️  Deleting Adam Hodges embeddings...');
    const adamResult = await pool.request().query`
      DELETE FROM FaceEmbeddings 
      WHERE PersonID = (SELECT ID FROM NameEvent WHERE neName = 'Adam Hodges')
    `;
    console.log(`  ✅ Deleted ${adamResult.rowsAffected[0]} embeddings`);

    // Delete Amy's embeddings
    console.log('🗑️  Deleting Amy Lynn Hodges (Morton) embeddings...');
    const amyResult = await pool.request().query`
      DELETE FROM FaceEmbeddings 
      WHERE PersonID = (SELECT ID FROM NameEvent WHERE neName = 'Amy Lynn Hodges (Morton)')
    `;
    console.log(`  ✅ Deleted ${amyResult.rowsAffected[0]} embeddings`);

    console.log('\n✨ Training data cleared successfully!');
    console.log('   You can now retrain with better photos.');

    await pool.close();
  } catch (err) {
    console.error('Error:', err);
  }
}

clearBadTrainingData();
