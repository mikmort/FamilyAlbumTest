// Quick script to check FaceEmbeddings data
const { query } = require('./api/shared/db');

async function checkEmbeddings() {
  try {
    console.log('Checking FaceEmbeddings table...\n');
    
    // Get summary statistics
    const summary = await query(`
      SELECT 
        COUNT(*) as TotalEmbeddings,
        COUNT(DISTINCT PersonID) as UniquePeople,
        COUNT(DISTINCT PhotoFileName) as UniquePhotos
      FROM FaceEmbeddings
    `);
    
    console.log('=== Summary ===');
    console.log(`Total Embeddings: ${summary[0].TotalEmbeddings}`);
    console.log(`Unique People: ${summary[0].UniquePeople}`);
    console.log(`Unique Photos: ${summary[0].UniquePhotos}`);
    console.log('');
    
    // Get breakdown by person
    const byPerson = await query(`
      SELECT 
        ne.neName as PersonName,
        COUNT(*) as EmbeddingCount,
        COUNT(DISTINCT fe.PhotoFileName) as PhotoCount
      FROM FaceEmbeddings fe
      INNER JOIN NameEvent ne ON fe.PersonID = ne.ID
      GROUP BY ne.neName
      ORDER BY COUNT(*) DESC
    `);
    
    console.log('=== Embeddings by Person ===');
    byPerson.forEach(row => {
      console.log(`${row.PersonName}: ${row.EmbeddingCount} embeddings from ${row.PhotoCount} photos`);
    });
    console.log('');
    
    // Check a sample embedding to see data quality
    const sample = await query(`
      SELECT TOP 1 
        PersonID,
        PhotoFileName,
        LEFT(Embedding, 100) as EmbeddingSample,
        LEN(Embedding) as EmbeddingLength,
        CreatedDate
      FROM FaceEmbeddings
      ORDER BY CreatedDate DESC
    `);
    
    if (sample.length > 0) {
      console.log('=== Sample Embedding ===');
      console.log(`PersonID: ${sample[0].PersonID}`);
      console.log(`PhotoFileName: ${sample[0].PhotoFileName}`);
      console.log(`Embedding Length: ${sample[0].EmbeddingLength} chars`);
      console.log(`Embedding Sample: ${sample[0].EmbeddingSample}...`);
      console.log(`Created: ${sample[0].CreatedDate}`);
      
      // Try to parse and validate the embedding
      try {
        const fullEmbedding = await query(`
          SELECT TOP 1 Embedding 
          FROM FaceEmbeddings 
          ORDER BY CreatedDate DESC
        `);
        const embeddingArray = JSON.parse(fullEmbedding[0].Embedding);
        console.log(`\nParsed Array Length: ${embeddingArray.length} values`);
        console.log(`First 5 values: [${embeddingArray.slice(0, 5).join(', ')}]`);
        console.log(`Value range: ${Math.min(...embeddingArray).toFixed(4)} to ${Math.max(...embeddingArray).toFixed(4)}`);
        
        if (embeddingArray.length === 128) {
          console.log('✓ Embedding has correct dimension (128)');
        } else {
          console.log(`✗ WARNING: Embedding has ${embeddingArray.length} dimensions (expected 128)`);
        }
      } catch (parseErr) {
        console.error('✗ ERROR parsing embedding JSON:', parseErr.message);
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkEmbeddings();
