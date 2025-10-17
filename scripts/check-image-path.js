const sql = require('mssql');

const config = {
    user: 'familyadmin',
    password: 'Jam3jam3!',
    server: 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net',
    database: 'FamilyAlbum',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

async function checkImagePath() {
    try {
        await sql.connect(config);
        console.log('Connected to database\n');

        // Check for the specific file
        const result = await sql.query`
            SELECT TOP 10 PictureID, PPath, PFileName, PThumbnailUrl
            FROM Pictures
            WHERE PFileName LIKE '%DevorahWedding%'
            OR PPath LIKE '%Family Pictures%'
            ORDER BY PictureID
        `;

        console.log('Found pictures:');
        result.recordset.forEach(row => {
            console.log(`ID: ${row.PictureID}`);
            console.log(`  Path: ${row.PPath}`);
            console.log(`  Filename: ${row.PFileName}`);
            console.log(`  Thumbnail URL: ${row.PThumbnailUrl}`);
            console.log('');
        });

        await sql.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkImagePath();
