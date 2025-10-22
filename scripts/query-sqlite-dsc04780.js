const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('C:\\Family Album\\FamilyAlbum.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

// Get the specific picture
db.all(`
  SELECT PFileName, PPeopleList FROM Pictures 
  WHERE PFileName LIKE '%DSC04780%'
`, (err, pictures) => {
  if (err) {
    console.error('Error querying pictures:', err.message);
    process.exit(1);
  }
  
  if (pictures.length === 0) {
    console.log('Picture not found in SQLite database');
    process.exit(1);
  }
  
  const pic = pictures[0];
  console.log('=== SQLite Database ===');
  console.log('File:', pic.PFileName);
  console.log('PPeopleList:', pic.PPeopleList);
  
  const ids = pic.PPeopleList.split(',').map(s => s.trim()).filter(Boolean);
  console.log('IDs in order:', ids);
  
  // Now look up each ID
  console.log('\n=== NameEvent Records (SQLite) ===');
  const placeholders = ids.map(() => '?').join(',');
  db.all(`
    SELECT ID, neName, neType FROM NameEvent 
    WHERE ID IN (${placeholders})
    ORDER BY CAST(ID AS INTEGER)
  `, ids, (err, rows) => {
    if (err) {
      console.error('Error querying NameEvent:', err.message);
      process.exit(1);
    }
    
    const nameMap = {};
    rows.forEach(r => {
      nameMap[r.ID] = { neName: r.neName, neType: r.neType };
    });
    
    ids.forEach((id, idx) => {
      const name = nameMap[id];
      if (name) {
        console.log(`${idx + 1}. ID ${id}: ${name.neName} (${name.neType})`);
      } else {
        console.log(`${idx + 1}. ID ${id}: NOT FOUND`);
      }
    });
    
    console.log('\n=== All IDs in order with names (SQLite) ===');
    ids.forEach((id, idx) => {
      const name = nameMap[id];
      console.log(`PPeopleList[${idx}] = ID ${id} -> ${name ? name.neName : 'NOT FOUND'}`);
    });
    
    db.close();
  });
});
