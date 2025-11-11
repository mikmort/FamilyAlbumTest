// Clear inaccurate birthdays and re-infer from birthday events
const sql = require('mssql');

async function clearAndReinferBirthdays() {
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

    // Step 1: Clear all existing birthdays
    console.log('═══════════════════════════════════════════════════');
    console.log('STEP 1: Clearing All Birthdays');
    console.log('═══════════════════════════════════════════════════\n');
    
    const clearQuery = `
      UPDATE NameEvent
      SET Birthday = NULL
      WHERE neType = 'N' AND Birthday IS NOT NULL
    `;
    
    const clearResult = await sql.query(clearQuery);
    console.log(`✓ Cleared ${clearResult.rowsAffected[0]} birthdays\n`);

    // Step 2: Infer birthdays from birthday events
    console.log('═══════════════════════════════════════════════════');
    console.log('STEP 2: Inferring Birthdays from Birthday Events');
    console.log('═══════════════════════════════════════════════════\n');
    
    // Find all birthday events and match them to people
    const birthdayEventsQuery = `
      WITH BirthdayEvents AS (
        SELECT 
          ne.ID as EventID,
          ne.neName as EventName,
          ne.EventDate,
          -- Extract person's name from event name
          -- Patterns: "Jeff's Birthday", "Mike's 5th Birthday", "Amy and Dan's Birthday"
          CASE 
            WHEN ne.neName LIKE '%''s%Birthday%' THEN 
              SUBSTRING(ne.neName, 1, CHARINDEX('''s', ne.neName) - 1)
            WHEN ne.neName LIKE '%''s%Bday%' THEN 
              SUBSTRING(ne.neName, 1, CHARINDEX('''s', ne.neName) - 1)
            WHEN ne.neName LIKE '%Birthday%' AND ne.neName NOT LIKE '%and%' THEN
              RTRIM(LTRIM(REPLACE(REPLACE(REPLACE(ne.neName, 'Birthday', ''), '''s', ''), 'First', '')))
            ELSE NULL
          END as ExtractedName
        FROM NameEvent ne
        WHERE ne.neType = 'E'
          AND (ne.neName LIKE '%Birthday%' OR ne.neName LIKE '%Bday%')
          AND ne.EventDate IS NOT NULL
      ),
      MatchedPeople AS (
        SELECT 
          be.EventID,
          be.EventName,
          be.EventDate,
          be.ExtractedName,
          p.ID as PersonID,
          p.neName as PersonName,
          -- Calculate similarity score (more precise matching)
          CASE 
            -- Exact full match (e.g., "Jeffrey B. Morton" for "Jeff")
            WHEN p.neName LIKE be.ExtractedName + ' %' + '%' THEN 100
            -- Match at start with middle name (e.g., "Jonathan Bart Morton" for "Jon")
            WHEN LEFT(p.neName, CHARINDEX(' ', p.neName + ' ') - 1) = be.ExtractedName THEN 100
            -- Exact match
            WHEN p.neName = be.ExtractedName THEN 100
            -- No match
            ELSE 0
          END as MatchScore,
          -- Count how many people would match this pattern
          (SELECT COUNT(*) 
           FROM NameEvent p2 
           WHERE p2.neType = 'N' 
             AND (p2.neName LIKE be.ExtractedName + ' %' + '%'
                  OR LEFT(p2.neName, CHARINDEX(' ', p2.neName + ' ') - 1) = be.ExtractedName
                  OR p2.neName = be.ExtractedName)
          ) as TotalMatches
        FROM BirthdayEvents be
        CROSS JOIN NameEvent p
        WHERE p.neType = 'N'
          AND be.ExtractedName IS NOT NULL
          AND LEN(be.ExtractedName) > 2
      )
      SELECT 
        PersonID,
        PersonName,
        EventName,
        EventDate,
        ExtractedName,
        MatchScore,
        TotalMatches
      FROM MatchedPeople
      WHERE MatchScore = 100
        AND TotalMatches = 1  -- Only use if there's exactly one match
      ORDER BY PersonName, EventDate
    `;

    const matches = await sql.query(birthdayEventsQuery);
    
    if (matches.recordset.length === 0) {
      console.log('No birthday events found with clear person name matches\n');
    } else {
      console.log(`Found ${matches.recordset.length} potential birthday matches:\n`);
      
      // Group by person and pick the most common date
      const birthdayMap = new Map();
      
      for (const match of matches.recordset) {
        if (!birthdayMap.has(match.PersonID)) {
          birthdayMap.set(match.PersonID, {
            personId: match.PersonID,
            personName: match.PersonName,
            dates: []
          });
        }
        
        birthdayMap.get(match.PersonID).dates.push({
          date: match.EventDate,
          eventName: match.EventName,
          matchScore: match.MatchScore
        });
      }
      
      let updatedCount = 0;
      
      for (const [personId, data] of birthdayMap.entries()) {
        // Pick the date that appears most often, or the earliest if tied
        const dateCounts = new Map();
        data.dates.forEach(d => {
          const dateStr = d.date.toISOString().split('T')[0];
          if (!dateCounts.has(dateStr)) {
            dateCounts.set(dateStr, { count: 0, events: [] });
          }
          dateCounts.get(dateStr).count++;
          dateCounts.get(dateStr).events.push(d.eventName);
        });
        
        // Find most common date
        let bestDate = null;
        let bestCount = 0;
        for (const [dateStr, info] of dateCounts.entries()) {
          if (info.count > bestCount) {
            bestDate = dateStr;
            bestCount = info.count;
          }
        }
        
        if (bestDate) {
          console.log(`  🎂 ${data.personName}`);
          console.log(`     Inferred Birthday: ${bestDate}`);
          console.log(`     Based on: ${bestCount} birthday event(s)`);
          console.log(`     Events: ${dateCounts.get(bestDate).events.join(', ')}\n`);
          
          // Update the person's birthday
          await sql.query`
            UPDATE NameEvent
            SET Birthday = ${bestDate}
            WHERE ID = ${personId}
          `;
          updatedCount++;
        }
      }
      
      console.log(`✓ Updated ${updatedCount} people with birthdays from events\n`);
    }

    // Step 3: Summary
    console.log('═══════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');
    
    const summary = await sql.query`
      SELECT 
        (SELECT COUNT(*) FROM NameEvent WHERE neType = 'N') as TotalPeople,
        (SELECT COUNT(*) FROM NameEvent WHERE neType = 'N' AND Birthday IS NOT NULL) as PeopleWithBirthdays,
        (SELECT COUNT(*) FROM NameEvent WHERE neType = 'E' AND (neName LIKE '%Birthday%' OR neName LIKE '%Bday%')) as TotalBirthdayEvents,
        (SELECT COUNT(*) FROM NameEvent WHERE neType = 'E' AND (neName LIKE '%Birthday%' OR neName LIKE '%Bday%') AND EventDate IS NOT NULL) as BirthdayEventsWithDates
    `;
    
    const stats = summary.recordset[0];
    console.log(`Total People: ${stats.TotalPeople}`);
    console.log(`People with Birthdays: ${stats.PeopleWithBirthdays} (${((stats.PeopleWithBirthdays/stats.TotalPeople)*100).toFixed(1)}%)`);
    console.log(`Birthday Events: ${stats.TotalBirthdayEvents}`);
    console.log(`Birthday Events with Dates: ${stats.BirthdayEventsWithDates}\n`);
    
    console.log('═══════════════════════════════════════════════════\n');
    console.log('✅ Birthday cleanup and re-inference completed!\n');
    
    await sql.close();
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error('\nFull error:', err);
    process.exit(1);
  }
}

clearAndReinferBirthdays();
