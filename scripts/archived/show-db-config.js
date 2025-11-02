// Diagnostic script to show database configuration (without password)
// Run this locally: node scripts/show-db-config.js

console.log('Database Configuration:');
console.log('======================');
console.log('');
console.log('To run the migration, you need to set these in .env.local:');
console.log('');
console.log('The values are stored in your Azure Static Web App settings.');
console.log('You can find them in:');
console.log('1. GitHub repository -> Settings -> Secrets and variables -> Actions');
console.log('   Look for: AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, AZURE_SQL_PASSWORD');
console.log('');
console.log('OR');
console.log('');
console.log('2. Azure Portal -> Your Static Web App -> Configuration');
console.log('   Look for application settings with those names');
console.log('');
console.log('Once you have them, create .env.local with:');
console.log('');
console.log('DB_SERVER=your-server.database.windows.net');
console.log('DB_DATABASE=your-database-name');
console.log('DB_USER=your-username');
console.log('DB_PASSWORD=your-password');
console.log('');
console.log('Then run: .\\scripts\\run-add-date-columns.ps1');
