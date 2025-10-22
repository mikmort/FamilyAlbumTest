const Database = require('better-sqlite3');

const db = new Database('C:\\Family Album\\FamilyAlbum.db');

// Find DSC04780 in SQLite
const pic = db.prepare(`
  SELECT PfileName, PPeopleList FROM Pictures WHERE PfileName LIKE '%DSC04780%'
`).all();

console.log('DSC04780 in SQLite:');
pic.forEach(p => {
  console.log('  Filename:', p.PfileName);
  console.log('  PPeopleList:', p.PPeopleList);
});

// Check NamePhoto associations for this file
console.log('\nNamePhoto associations for DSC04780:');
const npics = db.prepare(`
  SELECT npID, npFilename FROM NamePhoto WHERE npFilename LIKE '%DSC04780%'
`).all();

console.log(`  Found ${npics.length} associations`);
npics.forEach(np => {
  const ne = db.prepare('SELECT neName, neType FROM NameEvent WHERE ID = ?').get(np.npID);
  if (ne) {
    console.log(`    ID ${np.npID}: ${ne.neName} (${ne.neType})`);
  }
});

db.close();
