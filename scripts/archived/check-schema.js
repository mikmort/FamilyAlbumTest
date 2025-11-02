const DB = require('better-sqlite3');
const db = new DB('C:\\Family Album\\FamilyAlbum.db', {readonly: true});

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

tables.forEach(t => {
  const cols = db.pragma(`table_info(${t.name})`);
  console.log(`\n${t.name}:`);
  cols.forEach(c => console.log(`  ${c.name} (${c.type})`));
});

db.close();
