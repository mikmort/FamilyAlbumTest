const { checkAuthorization } = require('../../shared/auth');
const { query } = require('../../shared/db');

/**
 * Face Training Progress Endpoint
 * 
 * Get information about incomplete training sessions for resuming.
 * Requires Admin role.
 * 
 * GET /api/faces/training-progress
 */
module.exports = async function (context, req) {
  context.log('Face training progress processing request');

  // Check authorization - requires Admin role
  const { authorized, user, error } = await checkAuthorization(context, 'Admin');
  if (!authorized) {
    context.res = {
      status: 403,
      body: { error }
    };
    return;
  }

  try {
    // Check for incomplete training session
    const incompleteSession = await query(
      'EXEC dbo.sp_GetIncompleteTrainingSession'
    );

    if (incompleteSession && incompleteSession.length > 0) {
      const session = incompleteSession[0];
      
      context.res = {
        status: 200,
        body: {
          success: true,
          hasIncompleteSession: true,
          incompleteSession: {
            sessionId: session.SessionID,
            startedAt: session.StartedAt,
            trainingType: session.TrainingType,
            maxPerPerson: session.MaxPerPerson,
            totalPersons: session.TotalPersons,
            processedPersons: session.ProcessedPersons,
            totalPhotos: session.TotalPhotos,
            processedPhotos: session.ProcessedPhotos,
            successfulFaces: session.SuccessfulFaces,
            failedFaces: session.FailedFaces,
            percentComplete: session.TotalPhotos > 0 
              ? Math.round((session.ProcessedPhotos / session.TotalPhotos) * 100)
              : 0
          }
        }
      };
    } else {
      context.res = {
        status: 200,
        body: {
          success: true,
          hasIncompleteSession: false
        }
      };
    }

  } catch (err) {
    context.log.error('Error checking training progress:', err);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: err.message || 'Error checking training progress'
      }
    };
  }
};
