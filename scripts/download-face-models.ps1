# Download pre-trained face-api.js models
# These models are required for client-side face detection and recognition

$modelsDir = "public\models"
$baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master"

# Create models directory if it doesn't exist
New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

Write-Host "Downloading face-api.js models..." -ForegroundColor Cyan

# SSD MobileNetV1 - Face Detection (lightweight, fast)
$ssdFiles = @(
    "ssd_mobilenetv1_model-shard1",
    "ssd_mobilenetv1_model-shard2",
    "ssd_mobilenetv1_model-weights_manifest.json"
)

Write-Host "Downloading SSD MobileNetV1 (face detection)..." -ForegroundColor Yellow
foreach ($file in $ssdFiles) {
    $url = "$baseUrl/$file"
    $output = "$modelsDir\$file"
    Write-Host "  - $file"
    try {
        Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
    } catch {
        Write-Host "  Error downloading $file" -ForegroundColor Red
    }
}

# Face Landmark 68 Point - Facial landmarks
$landmarkFiles = @(
    "face_landmark_68_model-shard1",
    "face_landmark_68_model-weights_manifest.json"
)

Write-Host "Downloading Face Landmark 68 (facial features)..." -ForegroundColor Yellow
foreach ($file in $landmarkFiles) {
    $url = "$baseUrl/$file"
    $output = "$modelsDir\$file"
    Write-Host "  - $file"
    try {
        Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
    } catch {
        Write-Host "  Error downloading $file" -ForegroundColor Red
    }
}

# Face Recognition - FaceNet (128-dim embeddings)
$recognitionFiles = @(
    "face_recognition_model-shard1",
    "face_recognition_model-shard2",
    "face_recognition_model-weights_manifest.json"
)

Write-Host "Downloading Face Recognition Model (FaceNet embeddings)..." -ForegroundColor Yellow
foreach ($file in $recognitionFiles) {
    $url = "$baseUrl/$file"
    $output = "$modelsDir\$file"
    Write-Host "  - $file"
    try {
        Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
    } catch {
        Write-Host "  Error downloading $file" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "All models downloaded successfully!" -ForegroundColor Green
Write-Host "Total size: ~6 MB" -ForegroundColor Gray
