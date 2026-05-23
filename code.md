# Code Examples — Chatbot & RAG (direct excerpts, commented)

This file includes selected, minimal-but-real excerpts copied from the repository and lightly commented so you can paste them directly into your PFE report. Each excerpt is referenced to its canonical file in the project.

Notes:
- I trimmed files to the most relevant functions to keep examples readable.
- Comments beginning with "PFE:" explain why a block matters.

---

## 1. Chat turn orchestration (excerpt)
Source: server/src/workflows/chatRoute.js

```js
// PFE: core runChatTurn orchestrates the intake turn lifecycle.
async function runChatTurn({ userId, message }) {
  if (!userId) throw new Error('runChatTurn requires a userId.');

  // Load intake session + stage configuration
  const { session, stageConfig } = await LoadIntakeProtocol.execute(userId);

  // Respect an existing crisis hold — short-circuits the normal flow
  if (session.crisisHold) {
    const holdReply = await GenerateHighRiskResponse.executeEscalation(message);
    await PersistIntakeTurn.execute({
      userId,
      userMessage: message,
      assistantReply: holdReply,
      intakeStage: session.currentStage,
      session,
      skipStageCount: true
    });
    return { reply: holdReply, crisisHold: true };
  }

  // PFE: Run risk analysis (rule-based quick detector + LLM classifier)
  const riskPayload = await AnalyzeRiskBehavior.execute(message, userId, session);
  if (riskPayload && riskPayload.risk_level === 'HIGH') {
    // update counters, trigger alerting, and persist a high-risk assistant reply
    // (omitted here: code updates IntakeSession, triggers RiskAlertService)
    const highRiskReply = await GenerateHighRiskResponse.execute(message);
    await PersistIntakeTurn.execute({ userId, userMessage: message, assistantReply: highRiskReply, intakeStage: session.currentStage, session, skipStageCount: true });
    return { reply: highRiskReply, alertTriggered: true };
  }

  // PFE: Build RAG context
  const normalizedMessage = NormalizeDarijaText.execute(message);
  const vector = await ExtractVectorEmbedding.execute(normalizedMessage);

  let darijaContext = await RetrievePsychologicalContext.execute(vector);
  if (!darijaContext) darijaContext = await EnrichDarijaVocabulary.execute(normalizedMessage);

  const pdfKnowledgeContext = await RetrieveKnowledgeChunks.execute(message);

  const combinedContext = `=== DARIJA ===\n${darijaContext || 'None'}\n=== PDFs ===\n${pdfKnowledgeContext || 'None'}`;

  // Fetch recent turns (rolling window) and then generate a stage-aware reply
  const recentHistory = await ChatbotMessage.find({ userId }).sort({ createdAt: -1 }).limit(8).lean();
  recentHistory.reverse();

  const reply = await GenerateIntakeResponse.execute(
    message,
    combinedContext,
    stageConfig,
    recentHistory,
    riskPayload?.risk_level || 'LOW',
    BuildPersonaInstructions.execute(await LoadPersonaConfig.execute(userId), recentHistory.length === 0),
    session.contextSummary || null,
    { usedIds: new Set(session.usedExampleIds || []) }
  );

  // Persist and compress early context asynchronously
  await PersistIntakeTurn.execute({ userId, userMessage: message, assistantReply: reply, intakeStage: session.currentStage, session });
  compressEarlyContext(userId, session).catch(() => {});

  return { reply, stage: session.currentStage };
}
```

---

## 2. Ingest PDF knowledge (excerpt)
Source: server/src/workflows/ingestKnowledge.js

```js
// PFE: ingestion reads PDFs, splits text, embeds, and writes to Atlas Vector Search
const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.pdf'));

const embeddings = new GoogleGenerativeAIEmbeddings({ modelName: 'text-embedding-004', apiKey: process.env.GEMINI_API_KEY });

const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });

for (const file of files) {
  const filePath = path.join(KNOWLEDGE_DIR, file);
  const loader = new PDFLoader(filePath);
  const rawDocs = await loader.load();
  const docs = await splitter.splitDocuments(rawDocs);

  // Add metadata + store using LangChain's MongoDBAtlasVectorSearch helper
  const mappedDocs = docs.map(doc => { doc.metadata.source = file; doc.metadata.topic = 'psychology'; return doc; });
  await MongoDBAtlasVectorSearch.fromDocuments(mappedDocs, embeddings, { collection, indexName: 'vector_index', textKey: 'text', embeddingKey: 'embedding' });
}
```

---

## 3. Gemini MCP wrapper (excerpt)
Source: server/src/mcp/GeminiLLMServer.js

```js
class GeminiLLMServer {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.genAI = this.apiKey ? new ChatGoogleGenerativeAI({ apiKey: this.apiKey, model: 'gemini-1.5-flash', temperature: 0.7 }) : null;
    this.embeddingModel = this.apiKey ? new GoogleGenerativeAIEmbeddings({ apiKey: this.apiKey, modelName: 'gemini-embedding-001' }) : null;
    this.modelCandidates = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];
  }

  // PFE: create a vector embedding
  async embedContent(text) {
    if (!this.embeddingModel) throw new Error('GEMINI_API_KEY is not defined');
    const normalizedText = String(text || '').trim();
    if (!normalizedText) throw new Error('Cannot embed empty text.');
    return await this.embeddingModel.embedQuery(normalizedText);
  }

  // PFE: generate text; attempts candidate models then Groq fallback
  async generateContent(prompt) {
    if (!this.genAI) throw new Error('GEMINI_API_KEY is not defined');
    let lastError = null;
    for (const modelName of this.modelCandidates) {
      try {
        this.genAI.model = modelName;
        const result = await this.genAI.invoke(prompt);
        return result.content || '';
      } catch (error) {
        lastError = error;
        const message = String(error?.message || '');
        if (!/404 Not Found|not found|not supported/i.test(message)) throw error;
      }
    }

    // Groq fallback if configured
    if (process.env.GROQ_API_KEY) {
      const groqResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 500 }, { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } });
      return String(groqResponse.data?.choices?.[0]?.message?.content || '');
    }

    throw lastError || new Error('No supported Gemini model available.');
  }
}

module.exports = new GeminiLLMServer();
```

---

## 4. Risk analysis (quick detector + LLM wrapper)
Source: server/src/mcp/RiskAnalysisServer.js

```js
// PFE: immediate pattern detector (short-circuit HIGH-risk)
_detectImmediateRisk(message) {
  const fullText = String(message || '').toLowerCase();
  const selfHarmHit = HIGH_SELF_HARM_PATTERNS.find((pattern) => fullText.includes(pattern));
  if (selfHarmHit) {
    return this._buildPayload({ risk_level: 'HIGH', category: 'suicidal_ideation', score: 98, severity: 'critical', confidence: 1, signals_detected: [selfHarmHit], urgency: 'immediate', reasoning: 'Explicit self-harm language', recommended_action: 'Use safety protocol immediately.' });
  }
  // ... other pattern checks (omitted)
  return null;
}

// PFE: LLM-based classification with JSON output parsing and robust fallback
async classify(message, contextSnippet) {
  const immediate = this._detectImmediateRisk(message);
  if (immediate) return immediate;

  const prompt = `You are a clinical risk screening system... Return only valid JSON with this exact shape: {...}`;
  try {
    const rawResponse = await GeminiLLMServer.generateContent(prompt);
    return this._parseClassification(rawResponse, message, contextSnippet);
  } catch (error) {
    console.error('RiskAnalysisServer - classify Error:', error.message);
    return this._fallbackPayload(message, contextSnippet);
  }
}
```

---

## 5. Patient document ingestion & retrieval (excerpt)
Source: server/src/services/patientDocumentService.js

```js
// PFE: chunk + embed patient-uploaded PDFs and store in patient_doc_chunks
const chunks = await splitter.splitText(extractedText);
const embeddings = await createEmbeddings(chunks); // uses Gemini embeddings when available
const entries = chunks.map((content, index) => ({ documentId: document._id, psychologistId: document.psychologistId, patientId: document.patientId, chunkIndex: index, content, embedding: embeddings ? embeddings[index] : null, sourceName: document.originalName || '' }));
await PatientDocumentChunk.insertMany(entries);

// Retrieval: vector search if embeddings exist, else text search then regex
const pipeline = [{ $vectorSearch: { index: VECTOR_INDEX, path: 'embedding', queryVector: vector, numCandidates: 80, limit: topK, filter: documentFilter } }, { $project: { content: 1, chunkIndex: 1, sourceName: 1, score: { $meta: 'vectorSearchScore' } } }];
chunks = await collection.aggregate(pipeline).toArray();
```

---

## 6. Response generation & hallucination guardrails (excerpt)
Source: server/src/skills/GenerateEmpatheticResponse.js

```js
// PFE: Prompt template injects persona, RAG context, earlier summary, recent history
const promptTemplate = PromptTemplate.fromTemplate(`...`);

// Post-process: remove unsafe/generic phrases, strip medication/diagnosis hallucinations
_hallucinationFilter(text) {
  // checks medication names, diagnosis assertions, fabricated statistics, dosage patterns
  // logs warnings and removes offending sentences only
}

// Ensure reply remains short, stage-appropriate and includes one question at most
_normalizeTherapeuticResponse(text, fallbackQuestion) {
  // transforms LLM output to acknowledgment + single specific question
}
```

---

## 7. Persisting a turn (excerpt)
Source: server/src/skills/PersistIntakeTurn.js

```js
// PFE: Save both user and assistant turns then increment per-stage counter
await ChatbotMessage.insertMany([
  { userId, role: 'user', content: userMessage, intakeStage },
  { userId, role: 'assistant', content: assistantReply, intakeStage }
]);

if (!skipStageCount) {
  const stageKey = String(intakeStage);
  const currentCount = session.stageTurnCounts.get(stageKey) || 0;
  session.stageTurnCounts.set(stageKey, currentCount + 1);
  await session.save();
}
```

---

## 8. Client booking button (exact project usage)
Source: client/src/pages/PsychologistList.jsx

```jsx
// PFE: Booking button behavior — send logged-in users to the session create route,
// otherwise redirect to register (preserves previous UX behavior).
onClick={() => isLoggedIn() ? navigate(`/session/create/${psychologist._id}`) : navigate('/register')}
```

---

## 9. Tips for citing these fragments in the PFE
- Use the provided source paths when copying snippets into your report.
- For long code excerpts, present core functions and link to the full file in the appendix.
- Emphasize safety design (pattern detectors + LLM classifier + stateful crisis hold) and RAG dual-path (Darija lexical vs PDF knowledge) when describing contributions.

If you want, I can expand any of these excerpts into a runnable mini-example with a README and sample environment variables.

End of file.
# Code Examples — Chatbot & RAG (for PFE)

This file contains concise, annotated code examples extracted and adapted from the project to illustrate core chatbot, RAG, ingestion, safety, and booking flows for your PFE report.

---

## 1. Chat turn orchestration (server/src/workflows/chatRoute.js)
```js
// Simplified runChatTurn orchestration
async function runChatTurn({ userId, sessionId, message }) {
  const session = await IntakeSession.findById(sessionId);

  // 1) Risk analysis (rule-based filters + LLM classifier)
  const riskResult = await RiskAnalysisServer.classify(message);
  if (riskResult.level === 'HIGH') {
    session.consecutiveRiskCount = (session.consecutiveRiskCount || 0) + 1;
  }

  // 2) Normalize dialect / extract embeddings
  const normalized = NormalizeDarijaText.normalize(message);
  const embedding = await GeminiLLMServer.embedContent(normalized);

  // 3) RAG retrieval (darija + document chunks)
  const darijaCtx = await MongoVectorDBServer.search('darija_vector_index', embedding, { k: 3 });
  const docCtx = await MongoVectorDBServer.search('vector_index', embedding, { k: 4 });

  // 4) Build prompt and generate
  const prompt = BuildPersonaInstructions(session.persona, { darijaCtx, docCtx, recentHistory: session.recentTurns });
  const assistantReply = await GeminiLLMServer.generate(prompt);

  // 5) Persist turn
  await PersistIntakeTurn.execute({ sessionId, userId, message, assistantReply, embedding, riskResult });
  return assistantReply;
}
```

---

## 2. Prompt skeleton (server/src/skills/GenerateEmpatheticResponse.js)
```js
const basePrompt = ({ persona, stage, contextChunks, recentHistory, safetyInstructions }) => `
You are an empathetic clinical intake assistant.
Persona: ${persona.name} (tone=${persona.tone}, directiveness=${persona.directiveness})
Stage: ${stage.name} — ${stage.goal}

Safety rules:
${safetyInstructions}

Context (retrieved):
${contextChunks.map(c=>`- ${c.source}: ${c.text.slice(0,200)}`).join('\n')}

Recent history:
${recentHistory.join('\n')}

Write a short, stage-appropriate reply that collects information and remains within the safety constraints.
`;
```

---

## 3. Ingest PDF knowledge (server/src/workflows/ingestKnowledge.js)
```js
const fs = require('fs');
const pdfParse = require('pdf-parse');
async function ingestPdf(filePath) {
  const data = fs.readFileSync(filePath);
  const { text } = await pdfParse(data);
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
  const chunks = await splitter.splitText(text);
  for (const chunk of chunks) {
    const emb = await GeminiLLMServer.embedContent(chunk);
    await RagChunk.create({ text: chunk, embedding: emb, source: filePath });
  }
}
```

---

## 4. Gemini LLM server wrapper (server/src/mcp/GeminiLLMServer.js) — usage
```js
// embed
const emb = await GeminiLLMServer.embedContent('patient text here');
// generate
const out = await GeminiLLMServer.generate({ prompt: '...', model: 'gemini-1.5' });
```

---

## 5. Atlas Vector Search example (MongoDB aggregation)
```js
// server-side aggregation using Atlas Search vector operator
const results = await db.collection('rag_chunks').aggregate([
  {
    $search: {
      index: 'vector_index',
      knnBeta: {
        vector: embedding, // float[]
        path: 'embedding',
        k: 4
      }
    }
  },
  { $project: { text: 1, source: 1, score: { $meta: 'searchScore' } } }
]).toArray();
```

---

## 6. Patient document upload & chunking (server/src/services/patientDocumentService.js)
```js
// Express handler (multer middleware used upstream)
app.post('/api/documents/upload/:patientId', async (req, res) => {
  const file = req.file; // expecting multer single file
  const { text } = await pdfParse(file.buffer);
  const chunks = textSplitter.splitText(text);
  for (const c of chunks) {
    const emb = await GeminiLLMServer.embedContent(c);
    await PatientDocumentChunk.create({ patientId: req.params.patientId, text: c, embedding: emb });
  }
  res.json({ ok: true });
});
```

---

## 7. Risk classifier prompt & usage (server/src/services/RiskAnalysisServer.js)
```js
// classifier prompt (sent to LLM)
const classifierPrompt = (text) => `Classify the following user message into LOW/MEDIUM/HIGH risk for self-harm or harm-to-others. Return JSON: { level, category, confidence, rationale }\nMessage:\n"${text}"`;
const result = await GeminiLLMServer.generate({ prompt: classifierPrompt(userMessage), temperature: 0 });
// parse JSON and act upon it (e.g., escalate on HIGH)
```

---

## 8. Retry utility (utils/withRetry.js)
```js
async function withRetry(fn, { retries = 3, delay = 500 } = {}){
  let lastErr;
  for (let i=0;i<retries;i++){
    try { return await fn(); } catch(e){ lastErr=e; await new Promise(r=>setTimeout(r, delay*(i+1))); }
  }
  throw lastErr;
}
```

---

## 9. Client booking button (client/src/pages/PsychologistList.jsx)
```jsx
// inside a card component
<Button onClick={() => {
  if (auth.isLoggedIn()) navigate(`/session/create/${psych.id}`);
  else navigate('/register');
}}>Book Session</Button>
```

---

## 10. Example API calls

Chat turn (curl):
```bash
curl -X POST /api/chatbot/chatbot -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"sessionId":"<id>","message":"I feel hopeless today"}'
```

Submit summary feedback (curl):
```bash
curl -X POST /api/chatbot/summary/feedback -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"summaryId":"<id>","rating":4,"correctedEmotion":"sad"}'
```

---

## 11. Notes for the PFE report
- For each snippet, reference the canonical implementation files in the repo (examples: [server/src/workflows/chatRoute.js](server/src/workflows/chatRoute.js), [server/src/workflows/ingestKnowledge.js](server/src/workflows/ingestKnowledge.js), [server/src/mcp/GeminiLLMServer.js](server/src/mcp/GeminiLLMServer.js)).
- Keep the report examples short and focused on the algorithmic flow, not production plumbing.
- If you want, I can expand any snippet into a runnable mini-example and include a small README with instructions.

---

End of file.
