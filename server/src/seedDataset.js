require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const GeminiLLMServer = require('./mcp/GeminiLLMServer');
const MongoVectorDBServer = require('./mcp/MongoVectorDBServer');
const ExtractVectorEmbedding = require('./skills/ExtractVectorEmbedding');

// To run this script: 
// 1. Ensure you have a 'dataset.json' file in your server directory.
// 2. Format: [ { "darija": "mkhno9", "english": "suffocated/anxious", "category": "anxiety" }, ... ]
// 3. Run: node src/seedDataset.js

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully.');

    // Path to the dataset you downloaded from the internet
    const datasetPath = path.join(__dirname, '../dataset.json');
    
    if (!fs.existsSync(datasetPath)) {
      console.error(`ERROR: Dataset not found at ${datasetPath}`);
      console.log('Please create dataset.json in your server/ folder with an array of objects.');
      process.exit(1);
    }

    const rawData = fs.readFileSync(datasetPath, 'utf8');
    const dataset = JSON.parse(rawData);

    console.log(`Found ${dataset.length} items in dataset.json. Starting embedding process...`);

    for (let i = 0; i < dataset.length; i++) {
      const item = dataset[i];
      
      if (!item.darija || !item.english) {
        console.warn(`[Skip] Item missing required fields: ${JSON.stringify(item)}`);
        continue;
      }

      console.log(`Processing [${i + 1}/${dataset.length}]: ${item.darija}...`);

      const semanticPayload = `${item.darija} means ${item.english}. Category: ${item.category || 'unknown'}`;
      
      // Call our AI Skill to generate the vector
      const embedding = await ExtractVectorEmbedding.execute(semanticPayload);

      // Construct document
      const doc = {
        darija: item.darija,
        english: item.english,
        category: item.category || 'unknown',
        embedding: embedding,
        addedAt: new Date()
      };

      // Use MCP to insert into MongoDB
      await MongoVectorDBServer.insertKnowledge(doc);
      
      console.log(`  -> Successfully inserted '${item.darija}' into MongoDB.`);

      // Sleep lightly to avoid hitting Google Gemini API rate limits
      await new Promise(resolve => setTimeout(resolve, 500)); 
    }

    console.log('🎉 Database seeding complete!');
    process.exit(0);

  } catch (error) {
    console.error('Seeding process failed:', error);
    process.exit(1);
  }
}

seedDatabase();
