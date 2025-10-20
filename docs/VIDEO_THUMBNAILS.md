# Video Thumbnail Extraction

## Overview
The Family Album API now supports automatic video thumbnail generation using FFmpeg. When a video file is requested with `?thumbnail=true`, the system extracts a frame from the video and generates a proper thumbnail.

## How It Works

### 1. **Video Detection**
The system detects video files by extension:
- MP4
- MOV
- AVI
- WMV
- MPG/MPEG
- FLV

### 2. **Frame Extraction**
- Uses **fluent-ffmpeg** and **@ffmpeg-installer/ffmpeg** packages
- Extracts a frame at the **1-second mark** of the video
- Generates a 640px wide frame (height auto-calculated)
- Falls back to placeholder if extraction fails

### 3. **Thumbnail Processing**
- Extracted frame is resized to 300px width using Sharp
- Converts to JPEG format with 80% quality
- Uploads thumbnail to Azure Blob Storage
- Caches thumbnail for future requests

### 4. **Graceful Fallback**
If FFmpeg is not available:
- Uses a 1x1 transparent PNG placeholder
- Video playback still works normally
- Prominent video indicator shows in the UI

## Platform Support

### Development (Windows ARM64)
- FFmpeg binaries may not be available
- Code gracefully falls back to placeholders
- All other functionality works normally

### Production (Azure Functions - Linux x64)
- @ffmpeg-installer/ffmpeg provides pre-built Linux x64 binaries
- Full video thumbnail extraction works perfectly
- Automatic and transparent
- Switched from ffmpeg-static for better compatibility

## Dependencies

```json
{
  "fluent-ffmpeg": "^2.1.3",
  "@ffmpeg-installer/ffmpeg": "^1.1.0"
}
```

**Note:** Previously used `ffmpeg-static`, but switched to `@ffmpeg-installer/ffmpeg` for better cross-platform support and Azure Functions compatibility.

## API Usage

### Get Video Thumbnail
```
GET /api/media/{video-filename}?thumbnail=true
```

### Example
```
GET /api/media/family-vacation.avi?thumbnail=true
```

Returns a 300px JPEG thumbnail extracted from the video.

## Logging

The system logs detailed information about video thumbnail generation:
- "Video file detected, extracting frame with ffmpeg"
- "Frame extracted successfully"
- "Video thumbnail generated and saved"
- Falls back messages if extraction fails

## Performance

- **First request**: Extracts frame, generates thumbnail (~2-5 seconds)
- **Subsequent requests**: Serves cached thumbnail (~100ms)
- Temp files are automatically cleaned up after processing

## Troubleshooting

### FFmpeg Not Available
If you see "FFmpeg module not available" warnings:
- **Local dev**: Normal on Windows ARM64, placeholder used
- **Azure**: Check that ffmpeg-static installed correctly
- **Verify**: Run `node test-ffmpeg.js` in api folder

### Extraction Failures
If frame extraction fails:
- System automatically falls back to placeholder
- Error is logged but doesn't break the app
- Video playback still works normally

## Future Enhancements

- [ ] Configurable timestamp (currently fixed at 1 second)
- [ ] Multiple thumbnails per video
- [ ] Animated GIF thumbnails
- [ ] Video preview on hover
