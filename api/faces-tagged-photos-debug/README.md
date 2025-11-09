# Face Training Debug Endpoint

Diagnostic version of `/api/faces-tagged-photos` with extensive step-by-step logging.

## Purpose

Troubleshoot the "500 - Backend call failure" error in face training by identifying exactly where the process fails.

## Usage

```
GET /api/faces-tagged-photos-debug
```

## Response

Returns detailed diagnostic information:

```json
{
  "success": true,
  "diagnostic": true,
  "summary": {
    "peopleInDatabase": 15,
    "totalTaggedPairs": 1250,
    "personsWithPhotos": 12,
    "samplePhotosReturned": 10,
    "sasUrlGenerated": true,
    "sasError": null
  },
  "debugLog": [
    {
      "step": "START",
      "timestamp": "2025-11-09T12:34:56.789Z",
      "data": { ... }
    },
    ...
  ]
}
```

## Debug Steps

The endpoint logs these steps:

1. `START` - Request received
2. `AUTH_CHECK_START` / `AUTH_CHECK_COMPLETE` - Authorization
3. `DB_TEST_START` / `DB_TEST_COMPLETE` - Database connectivity
4. `PHOTO_PAIRS_COUNT_START` / `PHOTO_PAIRS_COUNT_COMPLETE` - Count tagged photos
5. `PERSON_COUNTS_START` / `PERSON_COUNTS_COMPLETE` - Photos per person
6. `SAMPLE_PHOTOS_START` / `SAMPLE_PHOTOS_COMPLETE` - Sample retrieval
7. `SAS_URL_START` / `SAS_URL_COMPLETE` - SAS URL generation
8. `FATAL_ERROR` - If something fails

## Testing

### Web Interface
Open `/debug-face-training.html` in your browser

### PowerShell
```powershell
.\scripts\test-face-training-diagnostic.ps1
```

### curl
```bash
curl http://localhost:7071/api/faces-tagged-photos-debug
```

## See Also

- `/docs/FACE_TRAINING_DEBUG_SUMMARY.md` - Complete guide
- `/docs/FACE_TRAINING_DIAGNOSTIC.md` - Detailed documentation
- `/public/debug-face-training.html` - Web test interface
