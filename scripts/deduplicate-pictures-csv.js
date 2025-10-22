const fs = require('fs');
const { parse } = require('csv-parse/sync');

// Read pictures CSV
const picturesTxt = fs.readFileSync('C:\\Temp\\pictures_export.csv', 'utf-8');
const picturesData = parse(picturesTxt, { columns: true, skip_empty_lines: true });

console.log('Total records before dedup:', picturesData.length);

// Deduplicate by keeping first occurrence of each filename (case-insensitive)
const seen = new Set();
const deduped = [];

for (const row of picturesData) {
  const key = row.PfileName.toLowerCase();
  if (!seen.has(key)) {
    seen.add(key);
    deduped.push(row);
  }
}

console.log('Total records after dedup:', deduped.length);
console.log('Duplicates removed:', picturesData.length - deduped.length);

// Get header from first row
const header = Object.keys(deduped[0]);

// Write back to CSV manually
let csv = header.map(h => `"${h}"`).join(',') + '\n';
csv += deduped.map(row => {
  return header.map(h => {
    const val = row[h] || '';
    // Escape quotes in values
    const escaped = String(val).replace(/"/g, '""');
    return `"${escaped}"`;
  }).join(',');
}).join('\n');

fs.writeFileSync('C:\\Temp\\pictures_export.csv', csv);

console.log('✓ Deduplicated CSV saved');
