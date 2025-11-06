const { query } = require('../shared/db');

/**
 * Automatic Face Recognition Training Trigger
 * 
 * This endpoint is called after a face confirmation to determine if automatic
 * training should be triggered based on the 20% threshold rule:
 * - If a person has 20%+ new confirmed faces since last training, trigger training
 * - Only trains for persons who meet the threshold
 * 
 * Example: Person with 100 faces trained needs 20+ new confirmations to retrain
 */
module.exports = async function (context, req) {
  context.log('Auto-train check triggered');

  try {
    // Query to find persons who need retraining based on 20% threshold
    const needsTrainingQuery = `
      WITH PersonStats AS (
        SELECT 
          p.ID as PersonID,
          p.DisplayName as PersonName,
          ISNULL(pe.FaceCount, 0) as TrainedFaceCount,
          (SELECT COUNT(*) 
           FROM FaceEncodings fe 
           WHERE fe.PersonID = p.ID 
           AND fe.IsConfirmed = 1) as TotalConfirmedFaces
        FROM 
          NameEvent p
          LEFT JOIN PersonEncodings pe ON p.ID = pe.PersonID
        WHERE 
          p.neType = 'N'
      )
      SELECT 
        PersonID,
        PersonName,
        TrainedFaceCount,
        TotalConfirmedFaces,
        (TotalConfirmedFaces - TrainedFaceCount) as NewFaces,
        CAST((TotalConfirmedFaces - TrainedFaceCount) AS FLOAT) / NULLIF(TrainedFaceCount, 0) as PercentageIncrease
      FROM 
        PersonStats
      WHERE 
        TrainedFaceCount > 0  -- Must have been trained before
        AND TotalConfirmedFaces > TrainedFaceCount  -- Has new faces
        AND (TotalConfirmedFaces - TrainedFaceCount) >= CEILING(TrainedFaceCount * 0.20)  -- 20% threshold
      ORDER BY 
        PercentageIncrease DESC;
    `;

    const result = await query(needsTrainingQuery);
    const personsNeedingTraining = result.recordset;

    if (personsNeedingTraining.length === 0) {
      context.log('No persons meet the 20% threshold for retraining');
      context.res = {
        status: 200,
        body: {
          success: true,
          trainingTriggered: false,
          message: 'No persons meet the 20% threshold for retraining',
          personsChecked: result.recordset.length
        }
      };
      return;
    }

    context.log(`${personsNeedingTraining.length} person(s) need retraining:`, 
      personsNeedingTraining.map(p => `${p.PersonName} (${p.NewFaces} new faces, ${Math.round(p.PercentageIncrease * 100)}% increase)`));

    // Get Python Function App URL
    const pythonFunctionUrl = process.env.PYTHON_FUNCTION_APP_URL || 'https://familyalbum-faces-api.azurewebsites.net';

    // Train each person individually
    const trainingResults = [];
    for (const person of personsNeedingTraining) {
      try {
        context.log(`Training person: ${person.PersonName} (ID: ${person.PersonID})`);
        
        const response = await fetch(`${pythonFunctionUrl}/api/faces/train`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId: person.PersonID })
        });

        const data = await response.json();
        
        trainingResults.push({
          personId: person.PersonID,
          personName: person.PersonName,
          newFaces: person.NewFaces,
          percentageIncrease: Math.round(person.PercentageIncrease * 100),
          success: data.success,
          error: data.error
        });

        context.log(`Training ${data.success ? 'succeeded' : 'failed'} for ${person.PersonName}`);
      } catch (err) {
        context.log.error(`Error training person ${person.PersonName}:`, err);
        trainingResults.push({
          personId: person.PersonID,
          personName: person.PersonName,
          newFaces: person.NewFaces,
          percentageIncrease: Math.round(person.PercentageIncrease * 100),
          success: false,
          error: err.message
        });
      }
    }

    const successCount = trainingResults.filter(r => r.success).length;

    context.res = {
      status: 200,
      body: {
        success: true,
        trainingTriggered: true,
        message: `Automatic training completed for ${successCount}/${personsNeedingTraining.length} person(s)`,
        results: trainingResults
      }
    };

  } catch (err) {
    context.log.error('Error in auto-train check:', err);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: err.message || 'Error checking for auto-training'
      }
    };
  }
};
