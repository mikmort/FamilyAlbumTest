const sql = require('mssql');

const config = {
    server: process.env.AZURE_SQL_SERVER,
    authentication: {
        type: 'default',
        options: {
            userName: process.env.AZURE_SQL_USER,
            password: process.env.AZURE_SQL_PASSWORD
        }
    },
    options: {
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 15000
    },
    database: 'FamilyAlbum'
};

async function checkThumbnailUrls() {
    const pool = new sql.ConnectionPool(config);
    
    try {
        await pool.connect();
        
        console.log('=== Checking PThumbnailUrl column in Pictures table ===\n');
        
        // Check how many have PThumbnailUrl
        const stats = await pool.request()
            .query(`
                SELECT 
                    COUNT(*) as total_records,
                    SUM(CASE WHEN PThumbnailUrl IS NOT NULL AND PThumbnailUrl != '' THEN 1 ELSE 0 END) as with_thumbnail_url,
                    SUM(CASE WHEN PThumbnailUrl IS NULL OR PThumbnailUrl = '' THEN 1 ELSE 0 END) as without_thumbnail_url
                FROM dbo.Pictures
            `);
        
        const stat = stats.recordset[0];
        console.log(`Total records: ${stat.total_records}`);
        console.log(`With PThumbnailUrl: ${stat.with_thumbnail_url}`);
        console.log(`Without PThumbnailUrl: ${stat.without_thumbnail_url}`);
        console.log(`Percentage with URL: ${(stat.with_thumbnail_url / stat.total_records * 100).toFixed(2)}%\n`);
        
        // Show sample of stored URLs
        console.log('=== Sample stored PThumbnailUrl values ===\n');
        const samples = await pool.request()
            .query(`
                SELECT TOP 10
                    PFileName,
                    PThumbnailUrl,
                    PType,
                    PYear
                FROM dbo.Pictures
                WHERE PThumbnailUrl IS NOT NULL AND PThumbnailUrl != ''
                ORDER BY PYear DESC
            `);
        
        if (samples.recordset.length > 0) {
            samples.recordset.forEach(row => {
                console.log(`File: ${row.PFileName}`);
                console.log(`  Type: ${row.PType === 1 ? 'Image' : 'Video'} | Year: ${row.PYear}`);
                console.log(`  Thumbnail URL: ${row.PThumbnailUrl}\n`);
            });
        } else {
            console.log('No PThumbnailUrl values found in database\n');
        }
        
        // Show what domains are used
        console.log('=== Thumbnail URL domains ===\n');
        const domains = await pool.request()
            .query(`
                SELECT DISTINCT
                    CASE 
                        WHEN PThumbnailUrl LIKE 'https://%' THEN SUBSTRING(PThumbnailUrl, 9, CHARINDEX('/', PThumbnailUrl, 9) - 9)
                        WHEN PThumbnailUrl LIKE 'http://%' THEN SUBSTRING(PThumbnailUrl, 8, CHARINDEX('/', PThumbnailUrl, 8) - 8)
                        ELSE 'Local Path'
                    END as domain,
                    COUNT(*) as count
                FROM dbo.Pictures
                WHERE PThumbnailUrl IS NOT NULL AND PThumbnailUrl != ''
                GROUP BY 
                    CASE 
                        WHEN PThumbnailUrl LIKE 'https://%' THEN SUBSTRING(PThumbnailUrl, 9, CHARINDEX('/', PThumbnailUrl, 9) - 9)
                        WHEN PThumbnailUrl LIKE 'http://%' THEN SUBSTRING(PThumbnailUrl, 8, CHARINDEX('/', PThumbnailUrl, 8) - 8)
                        ELSE 'Local Path'
                    END
                ORDER BY count DESC
            `);
        
        domains.recordset.forEach(row => {
            console.log(`  ${row.domain}: ${row.count} records`);
        });

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await pool.close();
    }
}

checkThumbnailUrls();
