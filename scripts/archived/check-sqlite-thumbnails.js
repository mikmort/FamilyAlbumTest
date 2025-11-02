const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Path to the SQLite database
const dbPath = 'C:\\Family Album\\FamilyAlbum.db';

if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at: ${dbPath}`);
    process.exit(1);
}

const db = new Database(dbPath);

try {
    console.log('=== Checking PThumbnailUrl in SQLite database ===\n');
    
    // Get table info
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`Available tables: ${tables.map(t => t.name).join(', ')}\n`);
    
    // Check Pictures table structure
    const schema = db.prepare("PRAGMA table_info(pictures)").all();
    console.log('=== Pictures table columns ===');
    schema.forEach(col => {
        console.log(`  ${col.name}: ${col.type}`);
    });
    console.log();
    
    // Check thumbnail URL statistics
    const stats = db.prepare(`
        SELECT 
            COUNT(*) as total_records,
            SUM(CASE WHEN PThumbnailUrl IS NOT NULL AND PThumbnailUrl != '' THEN 1 ELSE 0 END) as with_thumbnail_url,
            SUM(CASE WHEN PThumbnailUrl IS NULL OR PThumbnailUrl = '' THEN 1 ELSE 0 END) as without_thumbnail_url
        FROM pictures
    `).all();
    
    const stat = stats[0];
    console.log('=== PThumbnailUrl Statistics ===');
    console.log(`Total records: ${stat.total_records}`);
    console.log(`With PThumbnailUrl: ${stat.with_thumbnail_url || 0}`);
    console.log(`Without PThumbnailUrl: ${stat.without_thumbnail_url || 0}`);
    if (stat.total_records > 0) {
        console.log(`Percentage with URL: ${((stat.with_thumbnail_url || 0) / stat.total_records * 100).toFixed(2)}%\n`);
    }
    
    // Show sample of stored URLs
    console.log('=== Sample stored PThumbnailUrl values ===\n');
    const samples = db.prepare(`
        SELECT 
            filename,
            PThumbnailUrl,
            PType,
            PYear
        FROM pictures
        WHERE PThumbnailUrl IS NOT NULL AND PThumbnailUrl != ''
        LIMIT 20
    `).all();
    
    if (samples.length > 0) {
        samples.forEach(row => {
            console.log(`File: ${row.filename}`);
            console.log(`  Type: ${row.PType === 1 ? 'Image' : 'Video'} | Year: ${row.PYear}`);
            console.log(`  Thumbnail URL: ${row.PThumbnailUrl}\n`);
        });
    } else {
        console.log('No PThumbnailUrl values found in SQLite database\n');
    }
    
    // Show what the URLs look like (sample patterns)
    console.log('=== URL patterns in SQLite ===\n');
    const patterns = db.prepare(`
        SELECT DISTINCT PThumbnailUrl
        FROM pictures
        WHERE PThumbnailUrl IS NOT NULL AND PThumbnailUrl != ''
        LIMIT 10
    `).all();
    
    if (patterns.length > 0) {
        patterns.forEach((row, idx) => {
            console.log(`${idx + 1}. ${row.PThumbnailUrl}`);
        });
    } else {
        console.log('No URL patterns found');
    }

} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
} finally {
    db.close();
}
