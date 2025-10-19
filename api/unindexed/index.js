const sql = require('mssql');
const { getDbConfig } = require('../shared/db');

module.exports = async function (context, req) {
  context.log('Unindexed files API called');

  const action = context.bindingData.action || 'list';
  const method = req.method;

  try {
    const pool = await sql.connect(getDbConfig());

    // GET /api/unindexed - List all unindexed files
    if (method === 'GET' && action === 'list') {
      const result = await pool.request()
        .query(`
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
            uiDateAdded
          FROM UnindexedFiles
          WHERE uiStatus = 'N'
          ORDER BY uiDateAdded ASC
        `);

      context.res = {
        status: 200,
        body: {
          success: true,
          files: result.recordset
        }
      };
      return;
    }

    // GET /api/unindexed/count - Get count of unindexed files
    if (method === 'GET' && action === 'count') {
      const result = await pool.request()
        .query(`
          SELECT COUNT(*) as count
          FROM UnindexedFiles
          WHERE uiStatus = 'N'
        `);

      context.res = {
        status: 200,
        body: {
          success: true,
          count: result.recordset[0].count
        }
      };
      return;
    }

    // GET /api/unindexed/next - Get next unindexed file to process
    if (method === 'GET' && action === 'next') {
      const result = await pool.request()
        .query(`
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
            uiDateAdded
          FROM UnindexedFiles
          WHERE uiStatus = 'N'
          ORDER BY uiDateAdded ASC
        `);

      if (result.recordset.length === 0) {
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
          file: result.recordset[0]
        }
      };
      return;
    }

    // POST /api/unindexed/process - Process an unindexed file
    if (method === 'POST' && action === 'process') {
      const {
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

      if (!uiID || !fileName) {
        context.res = {
          status: 400,
          body: { success: false, error: 'uiID and fileName are required' }
        };
        return;
      }

      const transaction = pool.transaction();
      await transaction.begin();

      try {
        // 1. Insert into Pictures table
        const peopleList = people && people.length > 0 ? people.join(',') : '';
        
        await transaction.request()
          .input('fileName', sql.NVarChar, fileName)
          .input('directory', sql.NVarChar, directory || '')
          .input('description', sql.NVarChar, description || '')
          .input('month', sql.Int, month || null)
          .input('year', sql.Int, year || null)
          .input('peopleList', sql.NVarChar, peopleList)
          .input('nameCount', sql.Int, people ? people.length : 0)
          .input('thumbUrl', sql.NVarChar, thumbUrl || '')
          .input('type', sql.Int, type || 1)
          .input('time', sql.Int, vtime || 0)
          .input('blobUrl', sql.NVarChar, blobUrl || '')
          .input('reviewed', sql.Bit, 1)
          .query(`
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
          `);

        // 2. Insert into NamePhoto for each tagged person
        if (people && people.length > 0) {
          for (let i = 0; i < people.length; i++) {
            await transaction.request()
              .input('personID', sql.Int, people[i])
              .input('fileName', sql.NVarChar, fileName)
              .input('position', sql.Int, i)
              .query(`
                INSERT INTO NamePhoto (npID, npFileName, npPosition)
                VALUES (@personID, @fileName, @position)
              `);
          }

          // 3. Update neCount for each person
          for (const personID of people) {
            await transaction.request()
              .input('personID', sql.Int, personID)
              .query(`
                UPDATE NameEvent
                SET neCount = (
                  SELECT COUNT(*)
                  FROM NamePhoto
                  WHERE npID = @personID
                )
                WHERE ID = @personID
              `);
          }
        }

        // 4. Mark unindexed file as processed
        await transaction.request()
          .input('uiID', sql.Int, uiID)
          .query(`
            UPDATE UnindexedFiles
            SET uiStatus = 'P'
            WHERE uiID = @uiID
          `);

        await transaction.commit();

        context.res = {
          status: 200,
          body: {
            success: true,
            message: 'File processed successfully'
          }
        };
      } catch (error) {
        await transaction.rollback();
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

      await pool.request()
        .input('uiID', sql.Int, uiID)
        .query(`
          DELETE FROM UnindexedFiles
          WHERE uiID = @uiID
        `);

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
