/**
 * Review Event Dates and Clear Incorrect Ones
 * 
 * This script:
 * 1. Fetches all events with dates
 * 2. For each event, gets the photos and their dates
 * 3. Analyzes if the event date matches the photo dates
 * 4. Reports which dates appear incorrect
 * 
 * Usage: node scripts/review-and-clear-event-dates.js [--clear]
 * Add --clear flag to actually update the database
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Configuration
const DRY_RUN = !process.argv.includes('--clear');

// Try to load from environment variables first (used by GitHub Copilot coding agent)
// Fall back to local.settings.json for local development
let server, database, user, password;

if (process.env.AZURE_SQL_SERVER) {
  server = process.env.AZURE_SQL_SERVER;
  database = process.env.AZURE_SQL_DATABASE;
  user = process.env.AZURE_SQL_USER;
  password = process.env.AZURE_SQL_PASSWORD;
  console.log('Using database credentials from environment variables');
} else {
  const localSettingsPath = path.join(__dirname, '../api/local.settings.json');
  if (fs.existsSync(localSettingsPath)) {
    const localSettings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
    const values = localSettings.Values;
    server = values.AZURE_SQL_SERVER;
    database = values.AZURE_SQL_DATABASE;
    user = values.AZURE_SQL_USER;
    password = values.AZURE_SQL_PASSWORD;
    console.log('Using database credentials from local.settings.json');
  } else {
    console.error('❌ No database credentials found!');
    console.error('Either set environment variables (AZURE_SQL_*) or create api/local.settings.json');
    console.error('You can copy api/local.settings.json.template and fill in your credentials');
    process.exit(1);
  }
}

const config = {
    server,
    database,
    user,
    password,
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

async function reviewEventDates() {
    console.log('🔍 Reviewing Event Dates...\n');
    
    let pool;
    try {
        pool = await sql.connect(config);
        console.log('✅ Connected to database\n');

        // Get all events with dates
        const eventsQuery = `
            SELECT 
                ne.ID,
                ne.neName,
                ne.EventDate,
                ne.neCount
            FROM dbo.NameEvent ne
            WHERE ne.neType = 'E' 
                AND ne.EventDate IS NOT NULL
            ORDER BY ne.neName
        `;

        const events = await pool.request().query(eventsQuery);
        console.log(`📊 Found ${events.recordset.length} events with dates\n`);

        const eventsToUpdate = [];

        for (const event of events.recordset) {
            console.log(`\n📅 Event: ${event.neName}`);
            console.log(`   Current Date: ${event.EventDate ? new Date(event.EventDate).toLocaleDateString() : 'None'}`);
            console.log(`   Photo Count: ${event.neCount || 0}`);

            if (event.neCount > 0) {
                // Get photos for this event
                const photosQuery = `
                    SELECT TOP 10
                        p.PFileName,
                        p.PYear,
                        p.PMonth,
                        p.PTime,
                        DATEFROMPARTS(
                            CASE WHEN p.PYear BETWEEN 1900 AND 2100 THEN p.PYear ELSE NULL END,
                            CASE WHEN p.PMonth BETWEEN 1 AND 12 THEN p.PMonth ELSE 1 END,
                            1
                        ) as PhotoDate
                    FROM dbo.Pictures p
                    INNER JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName
                    WHERE np.npID = @eventId
                        AND p.PYear IS NOT NULL
                        AND p.PYear BETWEEN 1900 AND 2100
                    ORDER BY p.PYear, p.PMonth
                `;

                const photos = await pool.request()
                    .input('eventId', sql.Int, event.ID)
                    .query(photosQuery);

                if (photos.recordset.length > 0) {
                    const photoYears = photos.recordset.map(p => p.PYear);
                    const photoMonths = photos.recordset.map(p => p.PMonth).filter(m => m);
                    const uniqueYears = [...new Set(photoYears)];
                    const eventYear = new Date(event.EventDate).getFullYear();
                    const eventMonth = new Date(event.EventDate).getMonth() + 1;

                    console.log(`   Photo Years: ${uniqueYears.join(', ')}`);
                    console.log(`   Event Year: ${eventYear}`);

                    // Decision logic: Clear date if:
                    // 1. Event year doesn't match any photo year
                    // 2. Photos span multiple years (unless event name contains year)
                    // 3. Event month doesn't match photo months (if photos have month data)
                    
                    let shouldClear = false;
                    let reason = '';

                    if (!uniqueYears.includes(eventYear)) {
                        shouldClear = true;
                        reason = `Event year ${eventYear} not found in photo years`;
                    } else if (uniqueYears.length > 1 && !event.neName.includes(eventYear.toString())) {
                        shouldClear = true;
                        reason = `Photos span multiple years (${uniqueYears.join(', ')}) but event name doesn't specify year`;
                    } else if (photoMonths.length > 0) {
                        const uniqueMonths = [...new Set(photoMonths)];
                        if (uniqueMonths.length > 0 && !uniqueMonths.includes(eventMonth)) {
                            shouldClear = true;
                            reason = `Event month ${eventMonth} not found in photo months (${uniqueMonths.join(', ')})`;
                        }
                    }

                    if (shouldClear) {
                        console.log(`   ❌ WILL CLEAR: ${reason}`);
                        eventsToUpdate.push({
                            id: event.ID,
                            name: event.neName,
                            currentDate: event.EventDate,
                            reason: reason
                        });
                    } else {
                        console.log(`   ✅ Date appears correct`);
                    }
                } else {
                    console.log(`   ⚠️  No photos with year data found`);
                }
            } else {
                console.log(`   ⚠️  No photos tagged to this event`);
            }
        }

        // Summary
        console.log(`\n\n${'='.repeat(60)}`);
        console.log(`SUMMARY: ${eventsToUpdate.length} events will have dates cleared\n`);

        if (eventsToUpdate.length > 0) {
            console.log('Events to update:');
            eventsToUpdate.forEach((evt, idx) => {
                console.log(`${idx + 1}. ${evt.name}`);
                console.log(`   Current: ${new Date(evt.currentDate).toLocaleDateString()}`);
                console.log(`   Reason: ${evt.reason}\n`);
            });

            if (DRY_RUN) {
                console.log('\n⚠️  DRY RUN MODE - No changes made');
                console.log('To actually clear dates, run: node scripts/review-and-clear-event-dates.js --clear\n');
            } else {
                console.log('\n🔄 Clearing dates...\n');
                for (const evt of eventsToUpdate) {
                    await pool.request()
                        .input('eventId', sql.Int, evt.id)
                        .query(`
                            UPDATE dbo.NameEvent 
                            SET EventDate = NULL 
                            WHERE ID = @eventId
                        `);
                    console.log(`✅ Cleared date for: ${evt.name}`);
                }
                console.log('\n✅ All dates cleared successfully');
            }
        } else {
            console.log('✅ All event dates appear to be correct!');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

// Run the script
reviewEventDates().then(() => {
    console.log('\n✅ Script complete');
    process.exit(0);
}).catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
