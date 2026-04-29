# Automated Face Verification (ID vs Intro Video)

This feature adds an optional **admin-only** face match check that compares:

- ID card front image: `uploads/verification/{userId}/id/front.jpg`
- A frame extracted at **3 seconds** from the intro video: `uploads/verification/{userId}/video/intro.(mp4|mov|webm)`

It uses `@vladmandic/face-api` + `canvas` on the backend and `ffmpeg` (via `fluent-ffmpeg`) to extract a video frame.

## Install dependencies

From the repo root:

1. Install server deps:
   - `cd server`
   - `npm install`

> Note: `@tensorflow/tfjs-node` requires a Node.js version with an available native binary.
> On Windows this is most reliable on Node.js **v20 or v22 (LTS)**. If you run Node v24+,
> the face-check endpoint may fail to load native bindings.

2. Ensure `ffmpeg` is installed and available on your PATH:
   - Windows: install FFmpeg and add `ffmpeg.exe` to PATH
    - macOS: `brew install ffmpeg`
    - Linux: `sudo apt-get install ffmpeg`

## Add pretrained models

Download the pretrained models from the vladmandic face-api repo and place them in:

- `<repoRoot>/models/`

Models required (files in `<repoRoot>/models/`):
- `ssd_mobilenetv1_model.bin`
- `ssd_mobilenetv1_model-weights_manifest.json`
- `face_landmark_68_model.bin`
- `face_landmark_68_model-weights_manifest.json`
- `face_recognition_model.bin`
- `face_recognition_model-weights_manifest.json`

The backend loads these from disk on first run.

### One-command download (PowerShell)

From repo root:

- `powershell -ExecutionPolicy Bypass -File scripts\\download-face-models.ps1`

## API

Admin-only endpoint:

- `GET /api/verification/face-check/:userId`

Response:
```json
{ "match": true, "confidence": 87, "error": null }
```

## Admin UI

In `AdminPanel`, each pending verification shows an **Automated Face Verification** panel:

- Click **Run Face Check** to run the backend comparison and display match + confidence.
