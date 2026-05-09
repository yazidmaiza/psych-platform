// Script to list available Gemini models and their supported methods using the Google Generative AI API
// Usage: node listGeminiModels.js


require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('Missing GEMINI_API_KEY or GOOGLE_API_KEY in environment variables.');
  process.exit(1);
}

async function listModels() {
  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models';
    const res = await axios.get(url, {
      params: { key: API_KEY },
    });
    const models = res.data.models || [];
    console.log('Available Gemini Models:');
    models.forEach((model) => {
      console.log(`- ${model.name}`);
      if (model.supportedGenerationMethods) {
        console.log(`  Supported methods: ${model.supportedGenerationMethods.join(', ')}`);
      }
    });
  } catch (err) {
    console.error('Failed to list Gemini models:', err.response?.data || err.message);
    process.exit(1);
  }
}

listModels();
