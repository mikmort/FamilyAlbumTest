const Database = require('better-sqlite3');
const fs = require('fs');

const dbPath = 'C:\\Family Album\\FamilyAlbum.db';

if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at: ${dbPath}`);
    process.exit(1);
}

const db = new Database(dbPath);

try {
    console.log('=== Checking PThumbnail BLOB column in SQLite ===\n');
    
    // Check statistics
    const stats = db.prepare(`
        SELECT 
            COUNT(*) as total_records,
            SUM(CASE WHEN PThumbnail IS NOT NULL THEN 1 ELSE 0 END) as with_thumbnail_blob,
            SUM(CASE WHEN PThumbnail IS NULL THEN 1 ELSE 0 END) as without_thumbnail_blob,
            SUM(CASE WHEN PThumbnail IS NOT NULL THEN length(PThumbnail) ELSE 0 END) as total_blob_size_bytes,
            AVG(CASE WHEN PThumbnail IS NOT NULL THEN length(PThumbnail) ELSE 0 END) as avg_blob_size_bytes
        FROM pictures
    `).all();
    
    const stat = stats[0];
    console.log('=== PThumbnail Statistics ===');
    console.log(`Total records: ${stat.total_records}`);
    console.log(`With PThumbnail BLOB: ${stat.with_thumbnail_blob || 0}`);
    console.log(`Without PThumbnail BLOB: ${stat.without_thumbnail_blob || 0}`);
    if (stat.total_records > 0) {
        console.log(`Percentage with BLOB: ${((stat.with_thumbnail_blob || 0) / stat.total_records * 100).toFixed(2)}%`);
    }
    console.log(`Total BLOB size: ${(stat.total_blob_size_bytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Average BLOB size: ${stat.avg_blob_size_bytes ? (stat.avg_blob_size_bytes / 1024).toFixed(2) + ' KB' : 'N/A'}\n`);
    
    // Show samples with size info
    console.log('=== Sample records with thumbnail blobs ===\n');
    const samples = db.prepare(`
        SELECT 
            PfileName,
            PYear,
            PType,
            length(PThumbnail) as blob_size_bytes,
            substr(hex(PThumbnail), 1, 8) as blob_hex_start
        FROM pictures
        WHERE PThumbnail IS NOT NULL
        ORDER BY blob_size_bytes DESC
        LIMIT 20
    `).all();
    
    if (samples.length > 0) {
        console.log(`${samples.length} records shown (sorted by size):\n`);
        samples.forEach((row, idx) => {
            console.log(`${idx + 1}. ${row.PfileName}`);
            console.log(`   Year: ${row.PYear}, Type: ${row.PType === 1 ? 'Image' : 'Video'}`);
            console.log(`   Blob size: ${row.blob_size_bytes} bytes (${(row.blob_size_bytes / 1024).toFixed(2)} KB)`);
            console.log(`   Hex start: ${row.blob_hex_start}... (appears to be: ${identifyFormat(row.blob_hex_start)})\n`);
        });
    } else {
        console.log('No PThumbnail BLOB values found\n');
    }
    
    // Size distribution
    console.log('=== Size distribution ===\n');
    const distribution = db.prepare(`
        SELECT 
            CASE 
                WHEN length(PThumbnail) < 1024 THEN '< 1 KB'
                WHEN length(PThumbnail) < 10240 THEN '1-10 KB'
                WHEN length(PThumbnail) < 102400 THEN '10-100 KB'
                WHEN length(PThumbnail) < 1024000 THEN '100 KB - 1 MB'
                ELSE '> 1 MB'
            END as size_range,
            COUNT(*) as count,
            ROUND(AVG(length(PThumbnail)), 0) as avg_size
        FROM pictures
        WHERE PThumbnail IS NOT NULL
        GROUP BY size_range
        ORDER BY avg_size
    `).all();
    
    distribution.forEach(row => {
        console.log(`${row.size_range}: ${row.count} records, avg size: ${row.avg_size} bytes`);
    });

} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
} finally {
    db.close();
}

function identifyFormat(hexStart) {
    const hex = hexStart.toUpperCase();
    
    // Common file signatures
    if (hex.startsWith('FFD8')) return 'JPEG';
    if (hex.startsWith('89504E')) return 'PNG';
    if (hex.startsWith('47494F')) return 'GIF';
    if (hex.startsWith('424D')) return 'BMP';
    if (hex.startsWith('4D5A')) return 'EXE/DLL';
    if (hex.startsWith('7B5C')) return 'RTF';
    
    return 'Unknown format';
}
