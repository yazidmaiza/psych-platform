const fs = require('fs');
const path = require('path');
const os = require('os');
const { getPublicUploadsRoot, getPrivateUploadsRoot } = require('../utils/uploadRoots');
const Psychologist = require('../models/Psychologist');
const CredentialDocument = require('../models/CredentialDocument');
const { resolvePrivatePath } = require('./credentialDocumentStorage');

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
  const publicUploadsRoot = getPublicUploadsRoot();
  const privateUploadsRoot = getPrivateUploadsRoot();

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
    publicUploadsRoot,
    privateUploadsRoot,
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

  const probe = () =>
    new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, data) => (err ? reject(err) : resolve(data)));
    });

  const runExtract = (seekSeconds) =>
    new Promise((resolve, reject) => {
      const outDir = path.dirname(outFramePath);

      fs.mkdirSync(outDir, { recursive: true });
      if (fs.existsSync(outFramePath)) fs.unlinkSync(outFramePath);

      ffmpeg(videoPath)
        .seekInput(Math.max(0, Number(seekSeconds) || 0))
        .outputOptions(['-frames:v 1', '-q:v 2'])
        .output(outFramePath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

  let durationSec = null;
  try {
    const meta = await probe();
    const d = Number(meta?.format?.duration);
    durationSec = Number.isFinite(d) ? d : null;
  } catch (e) {
    // Best effort: if probing fails, we still try extraction at a safe timestamp.
  }

  const primarySeek = durationSec
    ? Math.min(3, Math.max(0, durationSec * 0.25))
    : 0.1;

  const attempts = Array.from(new Set([primarySeek, 0.1, 0]));
  let lastErr = null;

  for (const seek of attempts) {
    try {
      await runExtract(seek);
      if (fs.existsSync(outFramePath) && fs.statSync(outFramePath).size > 0) return;
      lastErr = new Error('Extracted frame is empty');
    } catch (err) {
      lastErr = err;
    }
  }

  const hint =
    durationSec !== null
      ? ` (video duration: ~${durationSec.toFixed(2)}s)`
      : '';

  throw new Error(`ffmpeg frame extraction failed${hint}: ${lastErr?.message || 'unknown error'}`);
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

    const uploadRoots = [getPrivateUploadsRoot(), getPublicUploadsRoot()];

    const findExistingPath = (segments) => {
      for (const root of uploadRoots) {
        const candidate = path.join(root, ...segments);
        if (fs.existsSync(candidate)) return candidate;
      }
      return null;
    };

    const resolveCredentialDocAbsolutePath = async (docOrId) => {
      const doc =
        docOrId && typeof docOrId === 'object' && docOrId.storagePath
          ? docOrId
          : docOrId
            ? await CredentialDocument.findById(docOrId).select('storagePath originalName mimeType')
            : null;
      if (!doc?.storagePath) return null;
      try {
        const { absolute } = resolvePrivatePath(doc.storagePath);
        if (fs.existsSync(absolute)) return absolute;
        return null;
      } catch (e) {
        return null;
      }
    };

    // Current system: CredentialDocument storage (private).
    const psychologist = await Psychologist.findOne({ userId: String(userId) })
      .select('_id userId credentialDocs')
      .lean();

    let idFrontPath = null;
    let introVideoPath = null;

    if (psychologist?.credentialDocs?.idFront || psychologist?.credentialDocs?.introVideo) {
      idFrontPath = await resolveCredentialDocAbsolutePath(psychologist?.credentialDocs?.idFront);
      introVideoPath = await resolveCredentialDocAbsolutePath(psychologist?.credentialDocs?.introVideo);
    }

    // Fallback: older deployments wrote to `uploads/(private|public)/verification/<userId>/...`
    if (!idFrontPath) {
      const idDirSegments = ['verification', String(userId), 'id'];
      idFrontPath =
        findExistingPath([...idDirSegments, 'front.jpg']) ||
        ['front.jpeg', 'front.png']
          .map((f) => findExistingPath([...idDirSegments, f]))
          .find(Boolean) ||
        null;
    }

    if (!introVideoPath) {
      const videoDirSegments = ['verification', String(userId), 'video'];
      introVideoPath = ['intro.mp4', 'intro.mov', 'intro.webm']
        .map((f) => findExistingPath([...videoDirSegments, f]))
        .find(Boolean) || null;
    }

    if (!idFrontPath) {
      if (psychologist?.credentialDocs?.idFront) {
        return safeResult({ match: false, confidence: 0, error: 'ID front document is linked but file is missing on disk' });
      }
      return safeResult({ match: false, confidence: 0, error: 'ID front image not found' });
    }
    if (!introVideoPath) {
      if (psychologist?.credentialDocs?.introVideo) {
        return safeResult({ match: false, confidence: 0, error: 'Intro video document is linked but file is missing on disk' });
      }
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
