const sql = require('mssql');

// Use GitHub secrets if available, otherwise fall back to local settings
const config = {
  server: process.env.AZURE_SQL_SERVER || '',
  database: process.env.AZURE_SQL_DATABASE || '',
  user: process.env.AZURE_SQL_USER || '',
  password: process.env.AZURE_SQL_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    requestTimeout: 30000, // 30 seconds for testing
  }
};

console.log('Testing database connection with:');
console.log('Server:', config.server);
console.log('Database:', config.database);
console.log('User:', config.user);
console.log('Password:', config.password ? '***' : 'not set');

async function testQuery() {
  try {
    console.log('\nConnecting to database...');
    const pool = await sql.connect(config);
    console.log('✓ Connected successfully');
    
    // This is the CTE query from faces-tagged-photos endpoint
    const photoPersonPairsCTE = `
      PhotoPersonPairs AS (
        -- Get tags from NamePhoto table (preferred source of truth)
        SELECT 
          np.npFileName as PFileName,
          np.npID as PersonID
        FROM dbo.NamePhoto np
        
        UNION
        
        -- Also get tags from PPeopleList field (fallback for photos not in NamePhoto)
        SELECT 
          p.PFileName,
          TRY_CAST(value AS INT) as PersonID
        FROM dbo.Pictures p
        CROSS APPLY STRING_SPLIT(p.PPeopleList, ',')
        WHERE p.PPeopleList IS NOT NULL 
          AND p.PPeopleList != ''
          AND LTRIM(RTRIM(value)) != ''
          AND TRY_CAST(value AS INT) IS NOT NULL
      )`;

    // Test the count query first
    const countQuery = `
      WITH ${photoPersonPairsCTE}
      SELECT 
        ne.ID as PersonID,
        ne.neName as PersonName,
        COUNT(DISTINCT pp.PFileName) as TotalPhotos
      FROM PhotoPersonPairs pp
      INNER JOIN dbo.NameEvent ne ON pp.PersonID = ne.ID
      WHERE ne.neType = 'N' -- Only people, not events
      GROUP BY ne.ID, ne.neName
      ORDER BY ne.neName
    `;
    
    console.log('\nExecuting count query...');
    console.log('Query:', countQuery);
    
    const result = await pool.request().query(countQuery);
    console.log('\n✓ Query executed successfully');
    console.log('Found', result.recordset.length, 'people with tagged photos');
    
    if (result.recordset.length > 0) {
      console.log('\nFirst few results:');
      result.recordset.slice(0, 3).forEach(row => {
        console.log(`  - ${row.PersonName}: ${row.TotalPhotos} photos`);
      });
    }
    
    await pool.close();
    console.log('\n✓ Test completed successfully');
    
  } catch (error) {
    console.error('\n✗ Error occurred:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testQuery();
