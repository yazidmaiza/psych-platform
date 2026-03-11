const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// @POST /api/sessions/:id/voice
exports.transcribeVoice = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No audio file provided' });

    // Send audio to Groq Whisper for transcription
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'fr');
    formData.append('response_format', 'json');

    const whisperResponse = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      formData,
      {
        headers: {
          Authorization: 'Bearer ' + process.env.GROQ_API_KEY,
          ...formData.getHeaders()
        }
      }
    );

    const transcribedText = whisperResponse.data.text;

    // Delete temp file
    fs.unlinkSync(req.file.path);

    res.status(200).json({ text: transcribedText });

  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};