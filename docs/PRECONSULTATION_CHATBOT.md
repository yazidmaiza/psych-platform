# Preconsultation Chatbot - Full Description

> **System role:** AI-assisted psychological intake assistant
> **Scope:** First-contact preconsultation conversations before the patient meets a licensed psychologist
> **Purpose:** Gather meaningful intake information while providing a warm, psychologically informed, non-diagnostic conversation

---

## 1. What The Chatbot Is

The preconsultation chatbot is the platform's AI intake assistant. It helps patients describe what brought them to the platform, explores their emotions and context, and prepares a concise summary of relevant concerns for the psychologist.

It is not a therapist, not a diagnosis engine, and not a treatment tool. Its job is to support intake, not to replace clinical care.

### Primary goals

- Make the patient feel heard and respected.
- Collect useful intake information before the psychologist session.
- Detect and respond safely to high-vulnerability or high-risk statements.
- Adapt to the patient's language and conversational style.
- Build a useful clinical context for the psychologist without over-interrogating the patient.

---

## 2. Conversation Principles

The chatbot is designed around a therapist-like intake style, with the following rules:

- Validate before exploring.
- Do not ask a question after every response.
- Avoid repeating the user's exact wording.
- Focus on emotions when that helps the conversation move forward.
- Use concrete, grounded questions instead of abstract ones.
- Summarize periodically so the patient feels understood.
- Pause exploration and prioritize empathy when the user expresses distress, shame, helplessness, loneliness, emptiness, self-hatred, or similar vulnerability.
- Keep responses concise and natural.

### Response styles it can use

- Validation
- Reflection
- Summary
- Emotion identification
- Gentle clarification
- Gentle psychoeducation
- One concrete question when it is genuinely useful

---

## 3. Supported Languages

The chatbot currently supports the languages used across the platform:

- English
- French
- Tunisian Darija
- Arabic script, with RTL-friendly handling on the UI side

### Language behavior

- The assistant detects the patient's language from the incoming message.
- It responds in the same language whenever possible.
- It mirrors the patient's level of formality.
- If the user sends only a greeting, the assistant returns a short greeting in the same language and may ask one brief follow-up question.

If a message arrives in a language not explicitly covered by the current detector, the system may fall back to English behavior unless the language rules are extended.

---

## 4. Intake Flow

The chatbot follows a stage-based intake structure. Each stage has a specific purpose and a limited number of turns so the conversation stays focused without feeling rushed.

### Stage 1 - Presenting Concern

- Goal: understand what brought the patient here.
- Focus: the main concern, complaint, or reason for seeking support.
- Style: open, welcoming, low-pressure.

### Stage 2 - Emotional Exploration

- Goal: understand feelings, intensity, triggers, and frequency.
- Focus: emotional language such as sadness, anger, grief, fear, guilt, shame, loneliness, or numbness.
- Style: empathetic and emotionally specific.

### Stage 3 - History and Context

- Goal: understand when the concern started, whether it happened before, and what support exists.
- Focus: background, prior episodes, prior help-seeking, support network.
- Style: clarifying, grounded, and patient.

### Stage 4 - Impact Assessment

- Goal: understand how the issue affects sleep, work, study, relationships, and daily functioning.
- Focus: practical impact and real-world consequences.
- Style: concrete and specific.

### Stage 5 - Closing / Synthesis

- Goal: summarize the session arc and check whether anything important is missing.
- Focus: synthesis of the main concern, emotional pattern, and impact.
- Style: concise closure that helps the patient feel understood.

### Stage transitions

- The system can warn the patient before a stage ends.
- It can also add a transition note when the stage is about to change.
- This avoids abrupt topic changes and helps the conversation feel continuous.

---

## 5. Response Generation Pipeline

The chatbot is implemented as a retrieval-augmented generation flow, not as a custom-trained model.

### Main pipeline

1. Normalize the incoming text, especially Darija / Arabizi variants.
2. Generate embeddings for retrieval.
3. Retrieve Darija psychological context from the vector store.
4. Fall back to vocabulary enrichment when no strong retrieval hit exists.
5. Retrieve relevant clinical PDF chunks.
6. Build the final prompt using:
   - persona instructions
   - stage goal and stage name
   - risk level
   - suggested probe questions
   - retrieved knowledge context
   - earlier conversation summary when present
   - recent conversation history
   - current patient message
7. Generate a reply with Gemini, then fall back to Groq if needed.
8. Post-process the answer to keep it concise, safe, and aligned with the conversation rules.

### Context handling

- The system keeps a rolling recent-history window.
- Earlier conversation details can be compressed into a summary so they are not lost.
- The model is instructed to build on earlier disclosures instead of re-asking the same questions.

---

## 6. Safety And Risk Handling

The chatbot is designed to remain supportive without crossing into diagnosis or therapy.

### Safety rules

- Never provide a diagnosis.
- Never suggest medication.
- Never replace urgent human care.
- Never dismiss high-risk disclosures.
- Maintain a calm, professional boundary.

### High-risk behavior

When the system detects high risk:

- It responds with a short safety-first message.
- It asks whether the patient is safe right now.
- It encourages immediate human support.
- It keeps the reply in the patient's language.
- It notifies the psychologist through the platform's risk-alert flow.

The surrounding system can also escalate to a crisis-hold state if repeated high-risk signals are detected.

---

## 7. Persona And Style Tuning

The chatbot supports a psychologist persona layer that changes style without changing its safety or structure.

### Persona influences

- Warmth
- Reflection depth
- Question style
- Directiveness
- Verbosity
- Pacing
- Greeting behavior

### What persona cannot change

- Safety rules
- Non-diagnostic boundaries
- The requirement to stay empathetic and natural
- The limit of at most one question when a question is used

This means a persona can shape tone and phrasing, but it cannot force the chatbot to become robotic, overly interrogative, or clinically detached.

---

## 8. What The Patient Experiences

From the patient's perspective, the chatbot should feel like a calm intake conversation rather than a questionnaire.

### Expected experience

- The patient explains what is happening in their own words.
- The chatbot validates the experience before moving deeper.
- The assistant may ask a specific follow-up grounded in the message.
- Every few turns, the assistant summarizes what it has understood.
- The conversation gradually moves from concern to feelings, context, impact, and closing.

### What the patient should not feel

- Interrogated
- Repeatedly asked the same question
- Forced to use clinical terminology
- Rushed through vulnerable disclosures
- Diagnosed by the system

---

## 9. Implementation References

The main implementation surface for this chatbot is:

- `server/src/workflows/chatRoute.js`
- `server/src/skills/GenerateEmpatheticResponse.js`
- `server/src/skills/BuildPersonaInstructions.js`
- `server/src/skills/GenerateHighRiskResponse.js`
- `server/src/seedIntakeProtocol.js`

The chatbot UI is surfaced through the patient-facing chat pages in the client application, while the backend handles prompt building, retrieval, safety checks, and persistence.

---

## 10. Short Operational Summary

In one sentence: the preconsultation chatbot is a multilingual, retrieval-augmented psychological intake assistant that validates the patient's experience, gathers clinically useful context, adapts to the user's language, and escalates safely when risk is detected.
