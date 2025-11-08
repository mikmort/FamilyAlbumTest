const sql = require('mssql');
const config = require('../api/local.settings.json').Values;

async function checkTrainingPhotos() {
  try {
    const pool = await sql.connect({
      server: config.AZURE_SQL_SERVER,
      database: config.AZURE_SQL_DATABASE,
      user: config.AZURE_SQL_USER,
      password: config.AZURE_SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false }
    });
    console.log('Connected to database\n');

    // Get sample of photos used for Adam and Amy
    console.log('📸 Checking photos used for training:\n');
    
    // Adam's training photos - get first 10 and check how many people are tagged
    const adamPhotos = await pool.request().query`
      SELECT DISTINCT 
        fe.PhotoFileName,
        p.PDescription as pTitle,
        (SELECT COUNT(*) FROM NamePhoto np WHERE np.npFileName = fe.PhotoFileName) as PeopleTaggedCount
      FROM FaceEmbeddings fe
      INNER JOIN Pictures p ON fe.PhotoFileName = p.PFileName
      WHERE fe.PersonID = (SELECT ID FROM NameEvent WHERE neName = 'Adam Hodges')
      ORDER BY fe.PhotoFileName
    `;

    console.log(`Adam Hodges - ${adamPhotos.recordset.length} unique photos used for training:`);
    adamPhotos.recordset.slice(0, 10).forEach(photo => {
      console.log(`  - ${photo.PhotoFileName}`);
      console.log(`    Title: ${photo.pTitle || 'No title'}`);
      console.log(`    People tagged: ${photo.PeopleTaggedCount}`);
    });

    // Amy's training photos
    const amyPhotos = await pool.request().query`
      SELECT DISTINCT 
        fe.PhotoFileName,
        p.PDescription as pTitle,
        (SELECT COUNT(*) FROM NamePhoto np WHERE np.npFileName = fe.PhotoFileName) as PeopleTaggedCount
      FROM FaceEmbeddings fe
      INNER JOIN Pictures p ON fe.PhotoFileName = p.PFileName
      WHERE fe.PersonID = (SELECT ID FROM NameEvent WHERE neName = 'Amy Lynn Hodges (Morton)')
      ORDER BY fe.PhotoFileName
    `;

    console.log(`\nAmy Lynn Hodges (Morton) - ${amyPhotos.recordset.length} unique photos used for training:`);
    amyPhotos.recordset.slice(0, 10).forEach(photo => {
      console.log(`  - ${photo.PhotoFileName}`);
      console.log(`    Title: ${photo.pTitle || 'No title'}`);
      console.log(`    People tagged: ${photo.PeopleTaggedCount}`);
    });

    // Check if these photos have multiple faces tagged
    console.log('\n🔍 Checking for problematic training scenarios:\n');
    
    const groupPhotos = await pool.request().query`
      SELECT 
        PersonName = ne.neName,
        PhotoFileName = fe.PhotoFileName,
        PeopleTaggedCount = (SELECT COUNT(*) FROM NamePhoto np WHERE np.npFileName = fe.PhotoFileName),
        EmbeddingsFromThisPhoto = COUNT(*)
      FROM FaceEmbeddings fe
      INNER JOIN NameEvent ne ON fe.PersonID = ne.ID
      WHERE ne.neName IN ('Adam Hodges', 'Amy Lynn Hodges (Morton)')
        AND (SELECT COUNT(*) FROM NamePhoto np WHERE np.npFileName = fe.PhotoFileName) > 3
      GROUP BY ne.neName, fe.PhotoFileName
      ORDER BY COUNT(*) DESC
    `;

    if (groupPhotos.recordset.length > 0) {
      console.log('⚠️  Photos with 4+ people tagged (likely group photos):');
      groupPhotos.recordset.slice(0, 10).forEach(row => {
        console.log(`  - ${row.PersonName}: ${row.PhotoFileName}`);
        console.log(`    People in photo: ${row.PeopleTaggedCount}, Embeddings: ${row.EmbeddingsFromThisPhoto}`);
      });
    } else {
      console.log('✅ No obvious group photos found in training data');
    }

    await pool.close();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkTrainingPhotos();
