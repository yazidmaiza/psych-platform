$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$modelsDir = Join-Path $repoRoot "models"

New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

# Using jsDelivr GitHub CDN for vladmandic/face-api model files
$base = "https://cdn.jsdelivr.net/gh/vladmandic/face-api@master/model"

$files = @(
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model.bin",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model.bin",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model.bin"
)

foreach ($file in $files) {
  $url = "$base/$file"
  $out = Join-Path $modelsDir $file

  Write-Host "Downloading $file..."
  Invoke-WebRequest -Uri $url -OutFile $out
}

Write-Host ""
Write-Host "Done. Models downloaded to: $modelsDir"

