// Infer and populate Event Dates and Birthdays from photo metadata
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

async function inferDates() {
  const config = {
    server: process.env.AZURE_SQL_SERVER || 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net',
    database: process.env.AZURE_SQL_DATABASE || 'FamilyAlbum',
    user: process.env.AZURE_SQL_USER || 'familyadmin',
    password: process.env.AZURE_SQL_PASSWORD || 'Jam3jam3!',
    options: {
      encrypt: true,
      trustServerCertificate: false
    }
  };

  console.log('Connecting to database...');
  console.log(`Server: ${config.server}`);
  console.log(`Database: ${config.database}\n`);
  
  try {
    await sql.connect(config);
    console.log('✓ Connected to database\n');

    // Step 1: Infer Event Dates
    console.log('═══════════════════════════════════════════════════');
    console.log('STEP 1: Inferring Event Dates from Photos');
    console.log('═══════════════════════════════════════════════════\n');
    
    const eventDateQuery = `
      WITH EventPhotoDates AS (
        SELECT 
          ne.ID,
          ne.neName,
          -- Try to get a clear date from photos
          MIN(CASE 
            -- If we have PDateEntered, use it
            WHEN p.PDateEntered IS NOT NULL THEN CAST(p.PDateEntered AS DATE)
            -- If we have year and month, construct date as first of month
            WHEN p.PYear IS NOT NULL AND p.PMonth IS NOT NULL 
              THEN DATEFROMPARTS(p.PYear, p.PMonth, 1)
            -- Otherwise use last modified as fallback
            WHEN p.PLastModifiedDate IS NOT NULL THEN CAST(p.PLastModifiedDate AS DATE)
            ELSE NULL
          END) as EarliestDate,
          MAX(CASE 
            WHEN p.PDateEntered IS NOT NULL THEN CAST(p.PDateEntered AS DATE)
            WHEN p.PYear IS NOT NULL AND p.PMonth IS NOT NULL 
              THEN DATEFROMPARTS(p.PYear, p.PMonth, 1)
            WHEN p.PLastModifiedDate IS NOT NULL THEN CAST(p.PLastModifiedDate AS DATE)
            ELSE NULL
          END) as LatestDate,
          -- Get the most common date (mode)
          (SELECT TOP 1 
            CAST(COALESCE(p2.PDateEntered, 
              CASE WHEN p2.PYear IS NOT NULL AND p2.PMonth IS NOT NULL 
                THEN DATEFROMPARTS(p2.PYear, p2.PMonth, 1) 
              END,
              p2.PLastModifiedDate) AS DATE) as CommonDate
           FROM NamePhoto np2
           JOIN Pictures p2 ON np2.npFileName = p2.PFileName
           WHERE np2.npID = ne.ID
             AND (p2.PDateEntered IS NOT NULL 
                  OR (p2.PYear IS NOT NULL AND p2.PMonth IS NOT NULL)
                  OR p2.PLastModifiedDate IS NOT NULL)
           GROUP BY CAST(COALESCE(p2.PDateEntered, 
              CASE WHEN p2.PYear IS NOT NULL AND p2.PMonth IS NOT NULL 
                THEN DATEFROMPARTS(p2.PYear, p2.PMonth, 1) 
              END,
              p2.PLastModifiedDate) AS DATE)
           ORDER BY COUNT(*) DESC
          ) as MostCommonDate,
          COUNT(*) as PhotoCount
        FROM NameEvent ne
        JOIN NamePhoto np ON ne.ID = np.npID
        JOIN Pictures p ON np.npFileName = p.PFileName
        WHERE ne.neType = 'E'  -- Events only
          AND ne.EventDate IS NULL  -- Only update events without a date
          AND (p.PDateEntered IS NOT NULL 
               OR (p.PYear IS NOT NULL AND p.PMonth IS NOT NULL)
               OR p.PLastModifiedDate IS NOT NULL)
        GROUP BY ne.ID, ne.neName
        HAVING COUNT(*) >= 3  -- At least 3 photos to infer date
      )
      SELECT 
        ID,
        neName,
        -- Use most common date if available, otherwise earliest
        COALESCE(MostCommonDate, EarliestDate) as InferredDate,
        EarliestDate,
        LatestDate,
        PhotoCount
      FROM EventPhotoDates
      WHERE COALESCE(MostCommonDate, EarliestDate) IS NOT NULL
      ORDER BY neName;
    `;

    const eventDates = await sql.query(eventDateQuery);
    
    if (eventDates.recordset.length === 0) {
      console.log('No events found that need date inference (all events either have dates or insufficient photo data)\n');
    } else {
      console.log(`Found ${eventDates.recordset.length} events with inferable dates:\n`);
      
      let eventUpdates = 0;
      for (const event of eventDates.recordset) {
        console.log(`  📅 ${event.neName}`);
        console.log(`     Inferred Date: ${event.InferredDate.toISOString().split('T')[0]}`);
        console.log(`     Range: ${event.EarliestDate.toISOString().split('T')[0]} to ${event.LatestDate.toISOString().split('T')[0]}`);
        console.log(`     Based on: ${event.PhotoCount} photos\n`);
        
        // Update the event
        await sql.query`
          UPDATE NameEvent 
          SET EventDate = ${event.InferredDate}
          WHERE ID = ${event.ID}
        `;
        eventUpdates++;
      }
      
      console.log(`✓ Updated ${eventUpdates} events with inferred dates\n`);
    }

    // Step 2: Infer Birthdays
    console.log('═══════════════════════════════════════════════════');
    console.log('STEP 2: Inferring Birthdays from Photos');
    console.log('═══════════════════════════════════════════════════\n');
    
    const birthdayQuery = `
      WITH PersonPhotoDates AS (
        SELECT 
          ne.ID,
          ne.neName,
          -- Get all photo dates for this person
          p.PYear,
          p.PMonth,
          p.PDateEntered,
          p.PLastModifiedDate,
          -- Check if photo has birthday indicators in filename/path
          CASE 
            WHEN p.PFileName LIKE '%birthday%' 
              OR p.PFileName LIKE '%bday%' 
              OR p.PFileName LIKE '%cake%'
              OR p.PDescription LIKE '%birthday%'
            THEN 1 ELSE 0 
          END as IsBirthdayPhoto,
          ROW_NUMBER() OVER (PARTITION BY ne.ID ORDER BY 
            CASE 
              WHEN p.PFileName LIKE '%birthday%' OR p.PFileName LIKE '%bday%' THEN 1
              WHEN p.PDateEntered IS NOT NULL THEN 2
              WHEN p.PYear IS NOT NULL AND p.PMonth IS NOT NULL THEN 3
              ELSE 4
            END
          ) as PhotoPriority
        FROM NameEvent ne
        JOIN NamePhoto np ON ne.ID = np.npID
        JOIN Pictures p ON np.npFileName = p.PFileName
        WHERE ne.neType = 'N'  -- People only
          AND ne.Birthday IS NULL  -- Only people without birthdays
          AND (p.PDateEntered IS NOT NULL 
               OR (p.PYear IS NOT NULL AND p.PMonth IS NOT NULL))
      )
      SELECT 
        ID,
        neName,
        -- If we have a birthday photo with a clear date, use it
        MAX(CASE 
          WHEN IsBirthdayPhoto = 1 AND PDateEntered IS NOT NULL 
            THEN CAST(PDateEntered AS DATE)
          WHEN IsBirthdayPhoto = 1 AND PYear IS NOT NULL AND PMonth IS NOT NULL
            THEN DATEFROMPARTS(PYear, PMonth, 1)
        END) as BirthdayPhotoDate,
        -- Get the earliest photo date (might indicate birth year)
        MIN(CASE 
          WHEN PDateEntered IS NOT NULL THEN YEAR(PDateEntered)
          WHEN PYear IS NOT NULL THEN PYear
        END) as EarliestYear,
        -- Count of birthday-related photos
        SUM(IsBirthdayPhoto) as BirthdayPhotoCount,
        COUNT(*) as TotalPhotos
      FROM PersonPhotoDates
      GROUP BY ID, neName
      HAVING MAX(CASE 
        WHEN IsBirthdayPhoto = 1 AND PDateEntered IS NOT NULL THEN 1
        WHEN IsBirthdayPhoto = 1 AND PYear IS NOT NULL AND PMonth IS NOT NULL THEN 1
        ELSE 0
      END) = 1  -- Only if we found a birthday photo with a date
      ORDER BY neName;
    `;

    const birthdays = await sql.query(birthdayQuery);
    
    if (birthdays.recordset.length === 0) {
      console.log('No birthdays could be inferred from photos');
      console.log('(Looked for photos with "birthday" in filename or path with clear dates)\n');
    } else {
      console.log(`Found ${birthdays.recordset.length} people with inferable birthdays:\n`);
      
      let birthdayUpdates = 0;
      for (const person of birthdays.recordset) {
        if (person.BirthdayPhotoDate) {
          console.log(`  🎂 ${person.neName}`);
          console.log(`     Inferred Birthday: ${person.BirthdayPhotoDate.toISOString().split('T')[0]}`);
          console.log(`     Based on: ${person.BirthdayPhotoCount} birthday photo(s) out of ${person.TotalPhotos} total\n`);
          
          // Update the person
          await sql.query`
            UPDATE NameEvent 
            SET Birthday = ${person.BirthdayPhotoDate}
            WHERE ID = ${person.ID}
          `;
          birthdayUpdates++;
        }
      }
      
      console.log(`✓ Updated ${birthdayUpdates} people with inferred birthdays\n`);
    }

    // Step 3: Summary Statistics
    console.log('═══════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');
    
    const summary = await sql.query`
      SELECT 
        (SELECT COUNT(*) FROM NameEvent WHERE neType = 'E') as TotalEvents,
        (SELECT COUNT(*) FROM NameEvent WHERE neType = 'E' AND EventDate IS NOT NULL) as EventsWithDates,
        (SELECT COUNT(*) FROM NameEvent WHERE neType = 'N') as TotalPeople,
        (SELECT COUNT(*) FROM NameEvent WHERE neType = 'N' AND Birthday IS NOT NULL) as PeopleWithBirthdays
    `;
    
    const stats = summary.recordset[0];
    console.log(`Events: ${stats.EventsWithDates}/${stats.TotalEvents} have dates (${((stats.EventsWithDates/stats.TotalEvents)*100).toFixed(1)}%)`);
    console.log(`People: ${stats.PeopleWithBirthdays}/${stats.TotalPeople} have birthdays (${((stats.PeopleWithBirthdays/stats.TotalPeople)*100).toFixed(1)}%)\n`);
    
    console.log('═══════════════════════════════════════════════════\n');
    console.log('✅ Date inference completed!');
    console.log('\nNext steps:');
    console.log('  • Review the inferred dates in Admin Settings');
    console.log('  • Manually add dates for events/people without enough photo data');
    console.log('  • Use the API to query events by date or upcoming birthdays\n');
    
    await sql.close();
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error('\nFull error:', err);
    process.exit(1);
  }
}

inferDates();
