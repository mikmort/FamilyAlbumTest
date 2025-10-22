const sql = require('mssql');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

const config = {
  server: process.env.AZURE_SQL_SERVER,
  authentication: {
    type: 'default',
    options: { 
      userName: process.env.AZURE_SQL_USER, 
      password: process.env.AZURE_SQL_PASSWORD 
    }
  },
  options: { encrypt: true, trustServerCertificate: false },
  database: 'FamilyAlbum'
};

function escapeSQL(val) {
  if (!val || val === '') return 'NULL';
  const s = String(val).replace(/'/g, "''");
  return `N'${s}'`;
}

async function reimportPicturesData() {
  const pool = new sql.ConnectionPool(config);
  
  try {
    await pool.connect();
    console.log('✓ Connected to Azure SQL\n');

    // [1] Read Pictures CSV
    console.log('[1] Reading Pictures CSV...');
    const picturesTxt = fs.readFileSync('C:\\Temp\\pictures_export.csv', 'utf-8');
    const picturesData = parse(picturesTxt, { columns: true, skip_empty_lines: true });
    console.log('  Read', picturesData.length, 'picture records');

    // [2] Read NamePhoto CSV
    console.log('[2] Reading NamePhoto CSV...');
    const namephotoTxt = fs.readFileSync('C:\\Temp\\namephoto_export.csv', 'utf-8');
    const namephotoData = parse(namephotoTxt, { columns: true, skip_empty_lines: true });
    console.log('  Read', namephotoData.length, 'namephoto records');

    // [3] Clear existing Pictures data
    console.log('\n[3] Clearing existing data...');
    await pool.request()
      .query('DELETE FROM dbo.NamePhoto; DELETE FROM dbo.Pictures;');
    console.log('  ✓ Cleared');

    // [4] Reimport Pictures in batches
    console.log('\n[4] Importing Pictures...');
    const pictureBatchSize = 500;
    for (let i = 0; i < picturesData.length; i += pictureBatchSize) {
      const batch = picturesData.slice(i, i + pictureBatchSize);
      let sql = 'INSERT INTO dbo.Pictures (PFileName, PFileDirectory, PDescription, PHeight, PWidth, PPeopleList, PMonth, PYear, PSoundFile, PDateEntered, PType, PLastModifiedDate, PReviewed, PTime, PNameCount) VALUES\n';
      
      sql += batch.map(row => {
        let month = 'NULL';
        if (row.PMonth !== undefined && row.PMonth !== '' && !isNaN(row.PMonth)) {
          const m = parseInt(row.PMonth);
          if (m >= 1 && m <= 12) month = m;
        }
        
        let year = 'NULL';
        if (row.PYear && !isNaN(row.PYear)) {
          const y = parseInt(row.PYear);
          if (y >= 1900 && y <= 2100) year = y;
        }
        
        const height = row.PHeight && !isNaN(row.PHeight) ? parseInt(row.PHeight) : 'NULL';
        const width = row.PWidth && !isNaN(row.PWidth) ? parseInt(row.PWidth) : 'NULL';
        
        let ptype = 'NULL';
        if (row.PType !== undefined && row.PType !== '' && !isNaN(row.PType)) {
          const p = parseInt(row.PType);
          if (p === 0) {
            ptype = 1; // Convert 0 to 1
          } else if (p >= 1 && p <= 3) {
            ptype = p;
          }
        }
        
        const time = row.PTime && !isNaN(row.PTime) ? Math.max(0, parseInt(row.PTime)) : '0';
        const namecount = row.PNameCount && !isNaN(row.PNameCount) ? Math.max(0, parseInt(row.PNameCount)) : '0';
        const reviewed = row.PReviewed ? (row.PReviewed.toLowerCase() === 'true' ? '1' : '0') : '0';
        
        return `(${escapeSQL(row.PfileName)}, ${escapeSQL(row.PfileDirectory)}, ${escapeSQL(row.PDescription)}, ${height}, ${width}, ${escapeSQL(row.PPeopleList)}, ${month}, ${year}, ${escapeSQL(row.PSoundFile)}, ${escapeSQL(row.PDateEntered)}, ${ptype}, ${escapeSQL(row.PLastModifiedDate)}, ${reviewed}, ${time}, ${namecount})`;
      }).join(',\n');
      
      sql += ';';
      await pool.request().query(sql);
      console.log(`  ✓ Imported ${Math.min(i + pictureBatchSize, picturesData.length)}/${picturesData.length}`);
    }

    // [5] Reimport NamePhoto in batches
    console.log('\n[5] Importing NamePhoto...');
    
    // First, get all valid IDs from NameEvent
    const validIds = await pool.request()
      .query('SELECT DISTINCT ID FROM dbo.NameEvent');
    const validIdSet = new Set(validIds.recordset.map(r => r.ID));
    console.log('  Valid person/event IDs:', validIdSet.size);
    
    // Get all valid filenames from Pictures (case-insensitive)
    const validFilenames = await pool.request()
      .query('SELECT DISTINCT PFileName FROM dbo.Pictures');
    const validFilenameSet = new Set(validFilenames.recordset.map(r => r.PFileName.toLowerCase()));
    console.log('  Valid picture filenames:', validFilenameSet.size);
    
    // Deduplicate NamePhoto by (npID, npFileName) and validate foreign keys
    // Use case-insensitive keys for deduplication
    const nphSeen = new Set();
    const nphDeduped = [];
    let skipped = 0;
    for (const row of namephotoData) {
      if (row.npId && !isNaN(row.npId) && validIdSet.has(parseInt(row.npId))) {
        // Validate filename exists in Pictures (case-insensitive)
        if (!validFilenameSet.has(row.npFilename.toLowerCase())) {
          skipped++;
          continue;
        }
        
        // Use case-insensitive key for deduplication
        const key = `${row.npId}|${row.npFilename.toLowerCase()}`;
        if (!nphSeen.has(key)) {
          nphSeen.add(key);
          nphDeduped.push(row);
        }
      }
    }
    console.log('  Deduplicated NamePhoto: ' + nphDeduped.length + ' records (removed ' + (namephotoData.length - nphDeduped.length - skipped) + ' dupes, ' + skipped + ' with missing pictures)');
    
    let importedCount = 0;
    const nphBatchSize = 500;
    for (let i = 0; i < nphDeduped.length; i += nphBatchSize) {
      const batch = nphDeduped.slice(i, i + nphBatchSize);
      
      if (batch.length === 0) continue;
      
      let sql = 'INSERT INTO dbo.NamePhoto (npID, npFileName) VALUES\n';
      
      sql += batch.map(row => {
        const npid = parseInt(row.npId);
        importedCount++;
        return `(${npid}, ${escapeSQL(row.npFilename)})`;
      }).join(',\n');
      
      sql += ';';
      await pool.request().query(sql);
      console.log(`  ✓ Imported batch ${Math.floor(i/nphBatchSize)+1}, total: ${importedCount}/${nphDeduped.length}`);
    }

    // [6] Verify
    console.log('\n[6] Verifying...');
    const picResult = await pool.request().query('SELECT COUNT(*) as cnt FROM dbo.Pictures');
    const nphResult = await pool.request().query('SELECT COUNT(*) as cnt FROM dbo.NamePhoto');
    console.log('  ✓ Pictures:', picResult.recordset[0].cnt);
    console.log('  ✓ NamePhoto:', nphResult.recordset[0].cnt);

    console.log('\n✅ REIMPORT COMPLETE!');
    console.log('Pictures and photo associations have been restored');
    
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

reimportPicturesData();
