const { checkAuthorization } = require('../shared/auth');

/**
 * Test endpoint to debug what uploadComplete receives
 * GET /api/test-upload-debug?fileName=test.mp4&fileModifiedDate=2024-01-15T10:30:00.000Z
 */
module.exports = async function (context, req) {
    context.log('Test upload debug called');

    const authResult = await checkAuthorization(context, 'Full');
    if (!authResult.authorized) {
        context.res = {
            status: authResult.status,
            headers: { 'Content-Type': 'application/json' },
            body: { error: authResult.message }
        };
        return;
    }

    const { fileName, fileModifiedDate } = req.query;
    
    let month = null;
    let year = null;

    if (fileModifiedDate) {
        try {
            const modDate = new Date(fileModifiedDate);
            context.log('Parsed date:', modDate);
            if (!isNaN(modDate.getTime())) {
                month = modDate.getMonth() + 1;
                year = modDate.getFullYear();
                context.log(`Extracted: ${month}/${year}`);
            }
        } catch (err) {
            context.log('Error parsing date:', err);
        }
    }

    context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
            received: {
                fileName,
                fileModifiedDate,
                fileModifiedDateType: typeof fileModifiedDate
            },
            parsed: {
                month,
                year,
                monthType: typeof month,
                yearType: typeof year
            },
            test: {
                dateNow: new Date().toISOString(),
                parsedDate: fileModifiedDate ? new Date(fileModifiedDate).toISOString() : null
            }
        }
    };
};
