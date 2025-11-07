# Face Training Progress - Deployment Checklist

## Pre-Deployment

- [ ] Review changes in `TRAINING_PROGRESS_SUMMARY.md`
- [ ] Review technical details in `FACE_TRAINING_PROGRESS.md`
- [ ] Backup current database (especially PersonEncodings if testing baseline)

## Database Deployment

- [ ] Connect to Azure SQL Database
- [ ] Run `database/face-training-progress-schema.sql`
- [ ] Verify tables created:
  ```sql
  SELECT * FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_NAME IN ('FaceTrainingProgress', 'FaceTrainingPhotoProgress');
  ```
- [ ] Verify stored procedures created:
  ```sql
  SELECT name FROM sys.procedures 
  WHERE name LIKE 'sp_%TrainingSession%' OR name LIKE 'sp_%TrainingProgress%';
  ```

## Python Function Deployment

- [ ] Updated file: `api-python/faces-seed/__init__.py`
- [ ] Deploy Python Function App:
  ```bash
  cd api-python
  func azure functionapp publish familyalbum-faces-api
  ```
- [ ] Verify deployment successful in Azure Portal
- [ ] Check function logs for startup errors

## Node.js API Deployment

- [ ] New endpoint: `api/faces/training-progress/`
- [ ] Updated endpoint: `api/faces/seed/` (documentation only)
- [ ] Deploy via GitHub Actions (push to main) OR
- [ ] Manual deployment:
  ```bash
  cd api
  npm install
  func azure functionapp publish familyalbum-api
  ```

## Frontend Deployment

- [ ] Updated file: `components/AdminSettings.tsx`
- [ ] Build Next.js app:
  ```bash
  npm run build
  ```
- [ ] Deploy static site (via GitHub Actions or manual)
- [ ] Verify no build errors

## Post-Deployment Testing

### 1. Verify API Endpoints

- [ ] Test training progress endpoint:
  ```bash
  curl https://your-site.azurestaticapps.net/api/faces/training-progress
  ```
  Should return: `{"success": true, "hasIncompleteSession": false}`

### 2. Test Baseline Training (5 per person)

- [ ] Log in as Admin
- [ ] Navigate to Admin Settings
- [ ] No incomplete session banner should appear (unless you have one)
- [ ] Click "Train Now"
- [ ] Verify status shows "Baseline training"
- [ ] Check Azure Function logs:
  ```
  Starting new Baseline training session
  maxPerPerson=5
  ```
- [ ] After completion, check database:
  ```sql
  SELECT * FROM FaceTrainingProgress 
  ORDER BY StartedAt DESC;
  -- Should show: TrainingType='Baseline', MaxPerPerson=5, Status='Completed'
  ```

### 3. Test Full Training

- [ ] Click "Train Now" again (after baseline completes)
- [ ] Verify status shows "Full training"
- [ ] Check logs show no maxPerPerson parameter
- [ ] Check database shows new session with MaxPerPerson=NULL

### 4. Test Resume Capability

- [ ] Start training
- [ ] Close browser tab mid-training
- [ ] Reopen Admin Settings
- [ ] Verify banner appears: "⚠️ Incomplete Training Session Found"
- [ ] Verify progress stats displayed correctly
- [ ] Click "Resume Training"
- [ ] Verify training continues (check logs for "Resuming session X")
- [ ] Verify completion marks session complete in database

### 5. Verify Progress Tracking

- [ ] During training, query database:
  ```sql
  -- View current session progress
  SELECT * FROM FaceTrainingProgress 
  WHERE Status = 'InProgress';
  
  -- View photo-level progress
  SELECT TOP 10 * FROM FaceTrainingPhotoProgress
  ORDER BY ProcessedAt DESC;
  ```

## Rollback Plan

If issues occur:

1. **Database**: No rollback needed - new tables don't affect existing functionality
2. **Python Function**: Redeploy previous version from Git
3. **Node.js API**: New endpoint is isolated, can be ignored
4. **Frontend**: Redeploy previous build

## Troubleshooting

### Banner always showing
- Check `FaceTrainingProgress` for stuck InProgress sessions
- Manually mark as Cancelled:
  ```sql
  UPDATE FaceTrainingProgress 
  SET Status = 'Cancelled', CompletedAt = GETDATE()
  WHERE Status = 'InProgress';
  ```

### Resume not working
- Check stored procedure returns data:
  ```sql
  EXEC sp_GetIncompleteTrainingSession;
  ```
- Verify session is < 24 hours old

### Progress not tracking
- Check Python function logs for errors
- Verify database connection works
- Test stored procedures manually

### Photos being reprocessed
- Check `FaceTrainingPhotoProgress` has entries
- Verify `Success=1` for processed photos
- Check Python function filter logic

## Success Criteria

✅ All tests pass  
✅ Baseline training uses 5 photos per person  
✅ Full training uses all photos  
✅ Resume capability works  
✅ Progress tracking accurate  
✅ No errors in logs  
✅ UI shows correct messages  

## Support

- Documentation: `FACE_TRAINING_PROGRESS.md`
- Summary: `TRAINING_PROGRESS_SUMMARY.md`
- Database schema: `database/face-training-progress-schema.sql`
- Python code: `api-python/faces-seed/__init__.py`
- UI code: `components/AdminSettings.tsx`
