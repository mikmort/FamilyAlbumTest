# Automatic Face Training System

## Overview

The Family Album implements an intelligent automatic training system that balances accuracy with computational efficiency. Training is triggered strategically based on the volume of new confirmed faces.

## Training Modes

### 1. Manual Training (Admin)
- **Location**: Admin Settings page
- **Access**: Admin role required
- **Button**: "🚀 Train Now"
- **Behavior**: Trains all persons with confirmed faces
- **Use Case**: Initial setup, bulk updates, or manual refresh

### 2. Automatic Training
- **Trigger**: After confirming face matches
- **Algorithm**: 20% threshold rule
- **Behavior**: Trains only persons who meet threshold
- **Use Case**: Ongoing incremental updates

## The 20% Threshold Algorithm

### How It Works

The system automatically triggers training for a person when they have accumulated **20% or more new confirmed faces** since their last training.

**Formula:**
```
NewFaces = TotalConfirmedFaces - TrainedFaceCount
TrainingNeeded = NewFaces >= (TrainedFaceCount × 0.20)
```

### Examples

| Scenario | Trained Count | New Confirmations | Threshold | Training Triggered? |
|----------|--------------|-------------------|-----------|---------------------|
| Small album | 10 faces | 2 new | 2 (20% of 10) | ✓ Yes |
| Medium album | 50 faces | 9 new | 10 (20% of 50) | ✗ No |
| Medium album | 50 faces | 10 new | 10 (20% of 50) | ✓ Yes |
| Large album | 100 faces | 19 new | 20 (20% of 100) | ✗ No |
| Large album | 100 faces | 21 new | 20 (20% of 100) | ✓ Yes |

### Why 20%?

- **Conservative**: Avoids excessive training for large albums
- **Meaningful**: 20% represents significant new data
- **Scalable**: Works well for both small and large collections
- **Performance**: Limits training frequency as collections grow

## Technical Implementation

### Database Query

The system uses this SQL query to identify persons needing training:

```sql
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
```

### API Endpoints

#### Manual Training
```
POST /api/faces/train
Authorization: Admin role required
Body (optional): { "personId": 123 }
Response: {
  "success": true,
  "personsUpdated": 5,
  "details": [
    {
      "personId": 123,
      "personName": "John Doe",
      "facesUsed": 45,
      "previousCount": 40
    }
  ]
}
```

#### Automatic Training Check
```
POST /api/faces-auto-train
Authorization: System call (triggered after face confirmation)
Response: {
  "success": true,
  "trainingTriggered": true,
  "message": "Automatic training completed for 2/2 person(s)",
  "results": [
    {
      "personId": 123,
      "personName": "John Doe",
      "newFaces": 12,
      "percentageIncrease": 24,
      "success": true
    }
  ]
}
```

#### Face Review Proxy
```
POST /api/faces/review
Authorization: Full role required
Body: {
  "action": "confirm",
  "faceId": 456,
  "personId": 123
}
Response: {
  "success": true,
  "message": "Face match confirmed",
  "faceId": 456,
  "personId": 123
}
Note: Automatically triggers training check after confirmation
```

### Workflow

1. **User confirms face match** in MediaDetailModal or FaceReview page
2. **Frontend calls** `POST /api/faces/review` with `action: "confirm"`
3. **Node.js proxy** forwards to Python function for confirmation
4. **Python function** updates database via `sp_ConfirmFaceMatch`
5. **Node.js proxy** receives success response
6. **Node.js proxy** triggers `POST /api/faces-auto-train` (non-blocking)
7. **Auto-train endpoint** queries persons needing training
8. **Auto-train endpoint** calls Python training function for each person
9. **Python training** calculates aggregate encodings and updates PersonEncodings
10. **User** sees immediate confirmation, training happens in background

## Admin UI

### Training Section in Admin Settings

The Admin Settings page includes a dedicated Face Recognition Training section:

```tsx
{/* Face Recognition Training Section */}
<div className="card">
  <h2>🧠 Face Recognition Training</h2>
  <p>Train the face recognition AI on confirmed face tags to improve accuracy and performance.</p>
  <button onClick={trainFaces} disabled={isTraining}>
    {isTraining ? '⏳ Training...' : '🚀 Train Now'}
  </button>
  
  {trainingStatus && (
    <div className="training-results">
      <div className="status">{trainingStatus}</div>
      {trainingResult?.success && (
        <ul>
          <li>Persons updated: {trainingResult.personsUpdated}</li>
          {trainingResult.details.map(detail => (
            <li>{detail.personName}: {detail.facesUsed} faces processed</li>
          ))}
        </ul>
      )}
    </div>
  )}
</div>
```

### Status Display

The UI shows:
- **Before training**: Blue button "🚀 Train Now"
- **During training**: Disabled button with spinner "⏳ Training..."
- **After training**: 
  - Success message in green
  - Number of persons updated
  - Details for each person (up to 5, then "and X more")

## Database Tables

### FaceEncodings
```sql
CREATE TABLE FaceEncodings (
  FaceID INT PRIMARY KEY IDENTITY,
  PFileName VARCHAR(255),
  Encoding NVARCHAR(MAX),  -- JSON array of 128 floats
  BoundingBox NVARCHAR(MAX),  -- JSON {top, right, bottom, left}
  PersonID INT,  -- Suggested or confirmed person
  Confidence FLOAT,  -- Detection confidence
  Distance FLOAT,  -- Match distance (lower = better)
  IsConfirmed BIT DEFAULT 0,
  IsRejected BIT DEFAULT 0,
  CreatedDate DATETIME DEFAULT GETDATE()
);
```

### PersonEncodings
```sql
CREATE TABLE PersonEncodings (
  PersonID INT PRIMARY KEY,
  AggregateEncoding NVARCHAR(MAX),  -- JSON array: mean of all confirmed encodings
  FaceCount INT,  -- Number of faces used in aggregate
  LastTrainedDate DATETIME,
  FOREIGN KEY (PersonID) REFERENCES NameEvent(NameID)
);
```

## Performance Characteristics

### Manual Training
- **Scope**: All persons with confirmed faces
- **Duration**: ~1-5 seconds per person (depends on face count)
- **Use Case**: Initial setup, major updates

### Automatic Training
- **Scope**: Only persons meeting 20% threshold
- **Frequency**: After each face confirmation (non-blocking)
- **Duration**: ~1-5 seconds per person triggered
- **Example**: In a collection with 20 people:
  - Typically 0-2 persons per confirmation
  - Most confirmations trigger no training
  - Large batch confirmations may trigger 3-5 trainings

## Best Practices

### Initial Setup
1. Upload photos and manually tag people
2. Once people have 5+ confirmed faces, run manual training
3. Continue tagging and let automatic training handle updates

### Ongoing Maintenance
1. Review and confirm face suggestions regularly
2. Automatic training handles incremental updates
3. Run manual training after:
   - Bulk photo imports
   - Major tagging sessions
   - When accuracy seems to decline

### Large Collections
- The 20% threshold scales automatically
- Person with 500 faces needs 100 new confirmations to retrain
- This prevents excessive training on stable, large collections
- Use manual training for forced refresh if needed

## Monitoring

### Logs

Check Azure Function logs for training activity:
```
Face confirmed, triggering auto-training check
3 person(s) need retraining:
  - John Doe (12 new faces, 24% increase)
  - Jane Smith (25 new faces, 50% increase)
  - Bob Johnson (5 new faces, 25% increase)
Training succeeded for John Doe
Training succeeded for Jane Smith
Training succeeded for Bob Johnson
Automatic training completed for 3/3 person(s)
```

### Database Queries

Check training status:
```sql
-- See when persons were last trained
SELECT 
  ne.NName,
  pe.FaceCount,
  pe.LastTrainedDate,
  DATEDIFF(day, pe.LastTrainedDate, GETDATE()) as DaysSinceTraining
FROM PersonEncodings pe
JOIN NameEvent ne ON pe.PersonID = ne.NameID
ORDER BY pe.LastTrainedDate DESC;

-- See persons needing training
-- (Same query as auto-train endpoint)
```

## Troubleshooting

### Training Not Triggering
- Check if person has been trained before (needs initial training)
- Verify person has 20%+ new confirmed faces
- Check Azure Function logs for auto-train calls
- Verify PYTHON_FUNCTION_APP_URL is set correctly

### Training Fails
- Check Python Function App logs
- Verify database connection
- Ensure persons have at least 1 confirmed face
- Check for invalid encoding data

### Training Too Frequent
- Current threshold is 20% (conservative)
- Can be adjusted in `/api/faces-auto-train/index.js`
- Change `CEILING(TrainedFaceCount * 0.20)` to higher percentage

### Training Too Rare
- Lower threshold from 20% to 10% or 15%
- Add manual training runs to supplement
- Check that confirmations are actually saving to database

## Future Enhancements

Possible improvements:
- **Configurable threshold**: Admin setting for percentage
- **Training queue**: Batch multiple persons together
- **Training history**: Log of all training runs
- **Performance metrics**: Track accuracy improvements
- **Smart scheduling**: Train during low-usage hours
- **Notifications**: Alert admins when training completes
