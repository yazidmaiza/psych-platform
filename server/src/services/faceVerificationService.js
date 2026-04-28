const fs = require('fs');
const path = require('path');
const os = require('os');

let modelsLoadedPromise = null;

const hasRequiredModels = (modelPath) => {
  // Accept either:
  // 1) "flat" vladmandic model files in modelPath root (recommended), OR
  // 2) legacy folder names (some setups use folders)
  const flatRequiredFiles = [
    'ssd_mobilenetv1_model-weights_manifest.json',
    'ssd_mobilenetv1_model.bin',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model.bin',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model.bin'
  ];

  const hasFlat = flatRequiredFiles.every((f) => fs.existsSync(path.join(modelPath, f)));
  if (hasFlat) return true;

  const legacyFolders = [
    'ssd_mobilenetv1_model',
    'face_landmark_68_model',
    'face_recognition_model'
  ];
  return legacyFolders.every((name) => fs.existsSync(path.join(modelPath, name)));
};

exports.getFaceCheckDiagnostics = () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const modelPath = path.join(repoRoot, 'models');
  const uploadsRoot = path.resolve(__dirname, '../../uploads');

  const nodeVersion = (typeof process !== 'undefined' && process.version) ? process.version : 'unknown';

  let faceApiLoadError = null;
  try {
    // This will throw if required dependencies are missing.
    require('@vladmandic/face-api/dist/face-api.node-wasm.js');
    require('@tensorflow/tfjs');
    require('@tensorflow/tfjs-backend-wasm');
  } catch (err) {
    faceApiLoadError = err?.message || String(err);
  }

  return {
    nodeVersion,
    uploadsRoot,
    modelPath,
    modelsPresent: fs.existsSync(modelPath),
    modelsComplete: fs.existsSync(modelPath) && hasRequiredModels(modelPath),
    ffmpegPath: process.env.FFMPEG_PATH || null,
    ffprobePath: process.env.FFPROBE_PATH || null,
    faceApiLoadError
  };
};

const loadModelsOnce = async () => {
  if (modelsLoadedPromise) return modelsLoadedPromise;

  modelsLoadedPromise = (async () => {
    let faceapi;
    try {
      // Use the WASM build to avoid native tfjs-node bindings (more compatible on Windows).
      faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
    } catch (err) {
      const msg = err?.message || String(err);
      const nodeVersion = (typeof process !== 'undefined' && process.version) ? process.version : 'unknown';
      throw new Error(`Face check backend failed to load: ${msg}`);
    }

    const tf = require('@tensorflow/tfjs');
    require('@tensorflow/tfjs-backend-wasm');

    // Ensure WASM backend is initialized.
    // tfjs-backend-wasm expects wasm binaries to be locatable; by default it uses its package dist folder.
    try {
      const wasmDist = path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm'));
      if (tf?.wasm?.setWasmPaths) tf.wasm.setWasmPaths(wasmDist + path.sep);
    } catch (e) {
      // best effort
    }
    await tf.setBackend('wasm');
    await tf.ready();

    const canvas = require('canvas');

    faceapi.env.monkeyPatch({
      Canvas: canvas.Canvas,
      Image: canvas.Image,
      ImageData: canvas.ImageData
    });

    const repoRoot = path.resolve(__dirname, '../../..');
    const modelPath = path.join(repoRoot, 'models');

    if (!fs.existsSync(modelPath)) {
      throw new Error('Face models folder not found. Create <repoRoot>/models and add the required model folders.');
    }
    if (!hasRequiredModels(modelPath)) {
      throw new Error('Face models are missing. Required: ssd_mobilenetv1_model, face_landmark_68_model, face_recognition_model.');
    }

    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);

    return { faceapi, canvas, modelPath };
  })();

  return modelsLoadedPromise;
};

const extractFrameAt3s = async (videoPath, outFramePath) => {
  const ffmpeg = require('fluent-ffmpeg');
  const ffmpegPath = process.env.FFMPEG_PATH;
  const ffprobePath = process.env.FFPROBE_PATH;

  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
  if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);

  await new Promise((resolve, reject) => {
    const outDir = path.dirname(outFramePath);
    const outName = path.basename(outFramePath);

    fs.mkdirSync(outDir, { recursive: true });
    if (fs.existsSync(outFramePath)) fs.unlinkSync(outFramePath);

    ffmpeg(videoPath)
      .on('end', resolve)
      .on('error', reject)
      .screenshots({
        timestamps: ['3'],
        filename: outName,
        folder: outDir
      });
  });
};

const getFaceDescriptorFromImage = async (imagePath) => {
  const { faceapi, canvas } = await loadModelsOnce();

  const img = await canvas.loadImage(imagePath);
  const cnv = canvas.createCanvas(img.width, img.height);
  const ctx = cnv.getContext('2d');
  ctx.drawImage(img, 0, 0, img.width, img.height);

  const detection = await faceapi
    .detectSingleFace(cnv)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return detection.descriptor;
};

/**
 * verifyFaceMatch(userId) → { match: Boolean, confidence: Number, error: String | null }
 */
exports.verifyFaceMatch = async (userId) => {
  const safeResult = (payload) => ({
    match: Boolean(payload.match),
    confidence: Number.isFinite(payload.confidence) ? payload.confidence : 0,
    error: payload.error ?? null
  });

  let framePath = null;
  try {
    if (!userId) return safeResult({ match: false, confidence: 0, error: 'userId is required' });

    // Uploads are stored relative to the server runtime (server/uploads/...)
    const uploadsRoot = path.resolve(__dirname, '../../uploads');
    const idDir = path.join(uploadsRoot, 'verification', String(userId), 'id');
    let idFrontPath = path.join(idDir, 'front.jpg');

    // Prefer mp4 but allow any intro.* extension.
    const videoDir = path.join(uploadsRoot, 'verification', String(userId), 'video');
    const candidateVideos = ['intro.mp4', 'intro.mov', 'intro.webm'].map((f) => path.join(videoDir, f));
    const introVideoPath = candidateVideos.find((p) => fs.existsSync(p));

    if (!fs.existsSync(idFrontPath)) {
      const candidates = ['front.jpg', 'front.jpeg', 'front.png'].map((f) => path.join(idDir, f));
      const alt = candidates.find((p) => fs.existsSync(p));
      if (!alt) return safeResult({ match: false, confidence: 0, error: 'ID front image not found' });
      idFrontPath = alt;
    }
    if (!introVideoPath) {
      return safeResult({ match: false, confidence: 0, error: 'Intro video not found' });
    }

    framePath = path.join(os.tmpdir(), `${String(userId)}_frame.jpg`);
    await extractFrameAt3s(introVideoPath, framePath);

    if (!fs.existsSync(framePath)) {
      return safeResult({ match: false, confidence: 0, error: 'Failed to extract video frame' });
    }

    const idDescriptor = await getFaceDescriptorFromImage(idFrontPath);
    if (!idDescriptor) {
      return safeResult({ match: false, confidence: 0, error: 'No face detected in ID front image' });
    }

    const frameDescriptor = await getFaceDescriptorFromImage(framePath);
    if (!frameDescriptor) {
      return safeResult({ match: false, confidence: 0, error: 'No face detected in video frame' });
    }

    const { faceapi } = await loadModelsOnce();
    const distance = faceapi.euclideanDistance(idDescriptor, frameDescriptor);

    const match = distance < 0.5;
    const confidence = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));

    return safeResult({ match, confidence, error: null });
  } catch (err) {
    return safeResult({ match: false, confidence: 0, error: err?.message || 'Face check failed' });
  } finally {
    try {
      if (framePath && fs.existsSync(framePath)) fs.unlinkSync(framePath);
    } catch (err) {
      // ignore
    }
  }
};
