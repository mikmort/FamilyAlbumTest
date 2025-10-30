const { query, execute } = require('../shared/db');

module.exports = async function (context, req) {
  context.log('Unindexed files API called');

  const action = context.bindingData.action || 'list';
  const method = req.method;

  try {
    // GET /api/unindexed - List all unindexed files
    if (method === 'GET' && action === 'list') {
      const result = await query(`
        SELECT 
          uiID,
          uiFileName,
          uiDirectory,
          uiThumbUrl,
          uiType,
          uiWidth,
          uiHeight,
          uiVtime,
          uiStatus,
          uiBlobUrl,
          uiDateAdded,
          uiMonth,
          uiYear
        FROM UnindexedFiles
        WHERE uiStatus = 'N'
        ORDER BY uiDateAdded ASC
      `);

      context.res = {
        status: 200,
        body: {
          success: true,
          files: result
        }
      };
      return;
    }

    // GET /api/unindexed/count - Get count of unindexed files
    if (method === 'GET' && action === 'count') {
      const result = await query(`
        SELECT COUNT(*) as count
        FROM UnindexedFiles
        WHERE uiStatus = 'N'
      `);

      context.res = {
        status: 200,
        body: {
          success: true,
          count: result[0].count
        }
      };
      return;
    }

    // GET /api/unindexed/next - Get next unindexed file to process
    if (method === 'GET' && action === 'next') {
      const result = await query(`
        SELECT TOP 1
          uiID,
          uiFileName,
          uiDirectory,
          uiThumbUrl,
          uiType,
          uiWidth,
          uiHeight,
          uiVtime,
          uiStatus,
          uiBlobUrl,
          uiDateAdded,
          uiMonth,
          uiYear
        FROM UnindexedFiles
        WHERE uiStatus = 'N'
        ORDER BY uiDateAdded ASC
      `);

      if (result.length === 0) {
        context.res = {
          status: 200,
          body: {
            success: true,
            file: null,
            message: 'No unindexed files remaining'
          }
        };
        return;
      }

      context.res = {
        status: 200,
        body: {
          success: true,
          file: result[0]
        }
      };
      return;
    }

    // POST /api/unindexed/process - Process an unindexed file
    if (method === 'POST' && action === 'process') {
      let {
        uiID,
        fileName,
        directory,
        description,
        month,
        year,
        eventID,
        people, // Array of person IDs
        blobUrl,
        thumbUrl,
        type,
        width,
        height,
        vtime
      } = req.body;

      // Normalize all file paths to use forward slashes
      if (fileName) fileName = fileName.replace(/\\/g, '/');
      if (directory) directory = directory.replace(/\\/g, '/');
      if (blobUrl) blobUrl = blobUrl.replace(/\\/g, '/');
      if (thumbUrl) thumbUrl = thumbUrl.replace(/\\/g, '/');

      if (!uiID || !fileName) {
        context.res = {
          status: 400,
          body: { success: false, error: 'uiID and fileName are required' }
        };
        return;
      }

      try {
        // 1. Insert into Pictures table
        const peopleList = people && people.length > 0 ? people.join(',') : '';
        
        await execute(`
          INSERT INTO Pictures (
            PFileName, PFileDirectory, PDescription, PMonth, PYear,
            PPeopleList, PNameCount, PThumbnailUrl, PType, PTime,
            PBlobUrl, PReviewed, PDateEntered, PLastModifiedDate
          )
          VALUES (
            @fileName, @directory, @description, @month, @year,
            @peopleList, @nameCount, @thumbUrl, @type, @time,
            @blobUrl, @reviewed, GETDATE(), GETDATE()
          )
        `, {
          fileName,
          directory: directory || '',
          description: description || '',
          month: month || null,
          year: year || null,
          peopleList,
          nameCount: people ? people.length : 0,
          thumbUrl: thumbUrl || '',
          type: type || 1,
          time: vtime || 0,
          blobUrl: blobUrl || '',
          reviewed: 1
        });

        // 2. Insert into NamePhoto for each tagged person
        if (people && people.length > 0) {
          for (let i = 0; i < people.length; i++) {
            await execute(`
              INSERT INTO NamePhoto (npID, npFileName, npPosition)
              VALUES (@personID, @fileName, @position)
            `, {
              personID: people[i],
              fileName: fileName,
              position: i
            });
          }

          // 3. Update neCount for each person
          for (const personID of people) {
            await execute(`
              UPDATE NameEvent
              SET neCount = (
                SELECT COUNT(*)
                FROM NamePhoto
                WHERE npID = @personID
              )
              WHERE ID = @personID
            `, { personID });
          }
        }

        // 4. Mark unindexed file as processed
        await execute(`
          UPDATE UnindexedFiles
          SET uiStatus = 'P'
          WHERE uiID = @uiID
        `, { uiID });

        context.res = {
          status: 200,
          body: {
            success: true,
            message: 'File processed successfully'
          }
        };
      } catch (error) {
        throw error;
      }

      return;
    }

    // DELETE /api/unindexed/{id} - Delete an unindexed file
    if (method === 'DELETE' && action) {
      const uiID = parseInt(action);
      
      if (isNaN(uiID)) {
        context.res = {
          status: 400,
          body: { success: false, error: 'Invalid file ID' }
        };
        return;
      }

      await execute(`
        DELETE FROM UnindexedFiles
        WHERE uiID = @uiID
      `, { uiID });

      context.res = {
        status: 200,
        body: {
          success: true,
          message: 'File deleted successfully'
        }
      };
      return;
    }

    // Unknown action
    context.res = {
      status: 400,
      body: { success: false, error: 'Unknown action' }
    };

  } catch (error) {
    context.log.error('Error in unindexed API:', error);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: error.message
      }
    };
  }
};
