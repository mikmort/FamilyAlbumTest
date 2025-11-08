const sql = require('mssql');
const config = require('../api/local.settings.json').Values;

async function checkTrainingData() {
  try {
    const pool = await sql.connect({
      server: config.AZURE_SQL_SERVER,
      database: config.AZURE_SQL_DATABASE,
      user: config.AZURE_SQL_USER,
      password: config.AZURE_SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false }
    });

    // Check total embeddings
    const total = await pool.request().query('SELECT COUNT(*) as total FROM FaceEmbeddings');
    console.log(`\n📊 Total Face Embeddings: ${total.recordset[0].total}\n`);

    // Check embeddings per person
    const perPerson = await pool.request().query(`
      SELECT 
        fe.PersonID, 
        COUNT(*) as EmbeddingCount, 
        ne.neName,
        MIN(fe.CreatedDate) as FirstTrained,
        MAX(fe.CreatedDate) as LastTrained
      FROM FaceEmbeddings fe 
      JOIN NameEvent ne ON fe.PersonID = ne.ID 
      GROUP BY fe.PersonID, ne.neName 
      ORDER BY EmbeddingCount DESC
    `);

    console.log('Embeddings per person:');
    perPerson.recordset.forEach(r => {
      console.log(`  ${r.neName}: ${r.EmbeddingCount} embeddings (${r.FirstTrained.toLocaleDateString()} - ${r.LastTrained.toLocaleDateString()})`);
    });

    // Check for Adam Hodges and Amy Lynn specifically
    console.log('\n🔍 Checking problematic people:\n');
    
    const adamDetails = await pool.request()
      .input('name', sql.VarChar, '%Adam Hodges%')
      .query(`
        SELECT fe.ID, fe.PersonID, ne.neName, fe.PhotoFileName, fe.CreatedDate
        FROM FaceEmbeddings fe
        JOIN NameEvent ne ON fe.PersonID = ne.ID
        WHERE ne.neName LIKE @name
        ORDER BY fe.CreatedDate DESC
      `);
    
    console.log(`Adam Hodges - ${adamDetails.recordset.length} embeddings:`);
    adamDetails.recordset.slice(0, 5).forEach(r => {
      console.log(`  - Photo: ${r.PhotoFileName} (${r.CreatedDate.toLocaleDateString()})`);
    });

    const amyDetails = await pool.request()
      .input('name', sql.VarChar, '%Amy Lynn%')
      .query(`
        SELECT fe.ID, fe.PersonID, ne.neName, fe.PhotoFileName, fe.CreatedDate
        FROM FaceEmbeddings fe
        JOIN NameEvent ne ON fe.PersonID = ne.ID
        WHERE ne.neName LIKE @name
        ORDER BY fe.CreatedDate DESC
      `);
    
    console.log(`\nAmy Lynn Hodges (Morton) - ${amyDetails.recordset.length} embeddings:`);
    amyDetails.recordset.slice(0, 5).forEach(r => {
      console.log(`  - Photo: ${r.PhotoFileName} (${r.CreatedDate.toLocaleDateString()})`);
    });

    await pool.close();
    console.log('\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTrainingData();
