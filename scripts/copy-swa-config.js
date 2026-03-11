const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'staticwebapp.config.json');
const outDir = path.join(__dirname, '..', 'out');
const targetPath = path.join(outDir, 'staticwebapp.config.json');

if (!fs.existsSync(sourcePath)) {
  console.error('staticwebapp.config.json not found at project root.');
  process.exit(1);
}

if (!fs.existsSync(outDir)) {
  console.error('Build output folder "out" does not exist. Run next build first.');
  process.exit(1);
}

fs.copyFileSync(sourcePath, targetPath);
console.log(`Copied staticwebapp.config.json to ${targetPath}`);
