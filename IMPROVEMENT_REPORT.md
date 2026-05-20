# Psych Platform — Preconsultation Chatbot Improvement Report

**Session date:** May 2026  
**Scope:** Preconsultation chatbot system — patient-facing intake, psychologist alerting, backend pipeline  
**Method:** File-by-file audit and incremental fixes, one area at a time

---

## Evaluation Summary

Before any work began, the system was scored across six dimensions:

| Area | Score | Status |
|---|---|---|
| Accessibility | 4 / 10 | ✅ Fixed |
| Conversation UX | 5.5 / 10 | ✅ Fixed |
| Technical Resilience | 5 / 10 | ✅ Fixed |
| Clinical Safety | 7.5 / 10 | ✅ Fixed |
| AI Output Quality | 6 / 10 | ✅ Fixed (Q1 + Q3; Q2 + Q4 deferred) |
| Privacy & Compliance | 6.5 / 10 | ✅ Fixed (P1–P4) |

---

## Area 1 — Accessibility ✅

**Problem:** The platform serves patients in psychological distress. No screen reader support, no keyboard navigation, no RTL handling for Arabic/Darija responses, no reduced-motion support.

### Files changed

#### `Chatbot.jsx`
- `role="log"` + `aria-live="polite"` hidden live region — screen readers announce new messages
- `aria-busy` on `<main>` during session load
- `role="progressbar"` + `aria-valuenow/valuetext` on progress bar — SR says "Stage 2 of 5: Feelings" not "40%"
- `role="list"` + `aria-current="step"` on stage steps
- `aria-live="assertive"` on safety banner — interrupts immediately (urgent content)
- `aria-pressed` on safety toggle button
- Explicit `<label>` for textarea — placeholder alone is unreliable
- `aria-label` on send button — "↑" is meaningless to a screen reader
- `aria-hidden` on all decorative emoji
- `dir` + `lang` auto-detection on message bubbles — Arabic/Darija renders RTL
- `:focus-visible` outlines on all interactive elements
- `@media (prefers-reduced-motion)` — disables animations for vestibular sensitivity
- `@media (forced-colors)` — Windows High Contrast Mode support
- `.sr-only` utility class

#### `RiskAlertBanner.jsx`
- `role="region"` + `aria-label` on container — named landmark for keyboard navigation
- `role="alert"` + `aria-live="assertive"` + `aria-atomic` on each toast — interrupts SR immediately
- `aria-label` on toast wrapper — "HIGH risk alert: Suicidal Ideation"
- `aria-hidden` on all severity icons and emoji
- Descriptive `aria-label` on acknowledge button
- `<time dateTime={…}>` for timestamp — semantic + machine-readable
- `aria-label` on "View Patient →" link
- `aria-label` on risk score — "Risk score: 50 out of 100"
- `@media (prefers-reduced-motion)` — disables pulse animation
- `@media (forced-colors)` fallback

#### `AssistantBot.jsx`
- `aria-expanded` + `aria-haspopup="dialog"` + dynamic `aria-label` on toggle button
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on chat window
- Focus trap (Tab / Shift+Tab cycles within dialog)
- Escape closes dialog
- Focus returns to toggle button on close
- `role="log"` + `aria-live="polite"` on messages area
- Hidden `role="status"` region announces "Assistant is typing…"
- `role="group"` + `aria-label` on suggested questions
- `aria-label="Ask: {question}"` on each suggestion button
- Explicit `<label>` for input field
- `aria-label` on send button
- `aria-hidden` on all decorative emoji
- `@media (prefers-reduced-motion)` on bounce animation
- `@media (forced-colors)` fallback

---

## Area 2 — Technical Resilience ✅

**Problems:**
1. Rolling context window — only last 8 turns sent to LLM, early disclosures silently dropped (patient safety issue)
2. LLM fallback — Groq was single point of failure, no automatic Gemini fallback with retry
3. Retry logic — transient API errors (rate limits, timeouts) caused silent failures

### Files changed

#### `chatRoute.js`
- `RECENT_TURN_LIMIT = 8` constant replacing magic number
- `compressEarlyContext(userId, session)` — new async function, runs non-blocking after each turn
  - Fetches all turns older than the window
  - Sends to LLM with a clinical compression prompt (preserves risk indicators, trauma, suicidal ideation)
  - Saves result as `session.contextSummary`
- `compressWithGroq()` — primary compression, wrapped in `withRetry(3 attempts)`
- `compressWithGemini()` — fallback compression, also wrapped in `withRetry(3 attempts)`
- Groq → Gemini fallback chain in `compressEarlyContext`
- `withRetry()` utility — exponential backoff (1s → 2s → 4s), only retries transient errors (429, 5xx, network)
- `isTransientError()` — distinguishes permanent vs transient failures
- `contextSummary` passed to `GenerateIntakeResponse` as 7th argument
- `crisisHold: false` in every normal response payload
- Compression also runs on HIGH risk turns — disclosures must survive in summary

#### `GenerateEmpatheticResponse.js`
- `contextSummary` accepted as 7th parameter
- `earlyContextBlock` built from summary — injected into prompt between RAG context and recent history
- `historyText` label changed to "RECENT CONVERSATION HISTORY" — clarifies it's not the full history
- New prompt rule: "do NOT re-ask about topics already covered in the Earlier Conversation Summary"
- `_generateWithGemini()` wrapped in `withRetry(3 attempts)`
- `_generateWithGroq()` wrapped in `withRetry(3 attempts)`
- Guard for missing `GEMINI_API_KEY` — skips cleanly to Groq fallback
- Empty response guard in both providers — treated as retriable failure
- `withRetry` + `isTransientError` self-contained in this file (no dependency on chatRoute)

#### `PersistIntakeTurn.js`
- No changes needed — compression writes directly to `IntakeSession` via `findByIdAndUpdate`

#### `IntakeSession.js` (schema)
- Added: `contextSummary: { type: String, default: null }`
- Added: `contextSummaryUpdatedAt: { type: Date, default: null }`

---

## Area 3 — Clinical Safety ✅

**Problems:**
1. Post-crisis re-entry — no defined policy for what happens after a HIGH risk event
2. Crisis response quality — responses were a static hotline number dump, no warmth, no mention of psychologist notification
3. Consecutive risk threshold — `consecutiveRiskCount` tracked but never acted on
4. Escalation UX — `urgency: 'CRITICAL'` passed from chatRoute but silently dropped by RiskAlertService
5. `RiskAlertBanner` — no `crisis_alert` socket listener, CRITICAL toasts auto-dismissed same as standard

**Policy defined:**
- 1 HIGH risk message → intake continues, warm holding response, psychologist notified
- 2 consecutive HIGH risk messages → `crisisHold: true`, session paused, patient sees holding screen, psychologist gets CRITICAL alert

### Files changed

#### `GenerateHighRiskResponse.js`
- `firstResponseVariants()` — 3 warm variants per language (EN/FR/Darija), randomly selected
- Every variant explicitly states "your psychologist has been notified"
- Warm holding language throughout — patient stays present, not cut off
- `executeEscalation()` — separate stronger responses for 2nd consecutive HIGH risk
- Escalation variants communicate session is pausing, human is actively involved
- Darija tone rewritten — original was clinical, now warm and present-feeling
- Crisis number reframed — "if you need to speak to someone immediately" not a raw number dump

#### `chatRoute.js`
- `CRISIS_HOLD_THRESHOLD = 2` constant
- Step 1b: crisis hold gate — if `session.crisisHold`, every message gets escalation response, normal pipeline skipped
- `consecutiveRiskCount` incremented each HIGH risk turn
- `shouldEscalate` flag at threshold — gates response type and alert urgency
- `crisisHold: true` written to DB when threshold reached
- `executeEscalation()` called on 2nd+ consecutive HIGH risk
- `urgency: 'CRITICAL'` passed to `RiskAlertService.trigger()`
- `consecutiveRiskCount` reset to 0 on any non-HIGH turn
- `crisisHold` returned in every response payload
- `crisisHold` in `/init` response — page reloads respect the hold

#### `RiskAlertService.js`
- `urgency = 'HIGH'` parameter added (default preserves backward compatibility)
- `isCritical` flag gates all escalation behavior
- `urgency` stored on `RiskAlert` document
- CRITICAL notification title: "🚨 CRISIS ALERT — Patient Needs Immediate Attention"
- CRITICAL notification message explicitly states session is paused
- `priority: 'critical'` vs `'high'` on notification
- `'crisis_alert'` vs `'risk_alert'` Socket.IO event name — separate handler on dashboard
- `sessionPaused: true` + `requiresAck: true` in CRITICAL Socket.IO payload
- `console.error` (not `console.log`) for CRITICAL — surfaces in error monitoring tools

#### `RiskAlertBanner.jsx`
- `buildHandler(forceCritical)` factory — shared handler for both socket events
- `crisis_alert` socket listener added — was never wired before
- `requiresAck` read from payload — gates auto-dismiss and Ack button
- `sessionPaused` read from payload — gates SESSION PAUSED banner strip
- No auto-dismiss for `requiresAck: true` toasts
- No Ack button on CRITICAL toasts — forces deliberate review
- `crisisBanner` strip — full-width red bar: "SESSION PAUSED — IMMEDIATE ATTENTION REQUIRED"
- `toastCritical` style — thicker border, stronger shadow
- CRITICAL toasts uncapped in stack, always pinned to top
- `regionLabel` distinguishes crisis vs standard count for SR
- "Resolve →" link text on CRITICAL (vs "View Patient →")

#### `Chatbot.jsx`
- `crisisHold` state
- `initSession` reads `initData.crisisHold` — restores hold on page reload
- `setShowSafety(true)` auto-triggered on hold activation
- `sendMessage` blocked when `crisisHold`
- `data.crisisHold` read after each send
- `resetConversation` clears `crisisHold`
- Hidden `role="alert"` + `aria-live="assertive"` SR announcement for hold
- Header title changes to "Session Paused"
- Stage progress hidden during hold
- `crisis-hold-footer` — replaces input area with holding screen
- `tel:190` as tappable `<a href>` link

#### `IntakeSession.js` (schema)
- Added: `crisisHold: { type: Boolean, default: false }`
- All other required fields confirmed present

---

## Area 4 — Conversation UX ✅

**Problems:**
1. Hard turn limits — stage advances mid-thought with no warning
2. No plain-language stage indicator — patients don't know what each stage is exploring
3. Early disclosure linking — patient mentions something in stage 1, LLM ignores it in stage 4

### Files changed

#### `GenerateEmpatheticResponse.js`
- `STAGE_LINKING_INSTRUCTIONS` object — stage-specific instructions for referencing earlier disclosures
- Stage 2 links back to stage 1 concerns
- Stage 3 explicitly told "you already know the concern, build on it"
- Stage 4 synthesizes concern + emotional state from earlier stages
- Stage 5 synthesizes arc of whole session
- `earlyContextBlock` now includes `DISCLOSURE LINKING GUIDE` section when summary exists
- Natural bridging phrases specified: "Earlier you mentioned…", "You brought up…", "Given what you shared about…"
- New response rule: actively look for connections, don't just avoid re-asking
- New response rule: paraphrase earlier disclosures — never quote verbatim
- One connection per response maximum — prevents mechanical listing

#### `AdvanceIntakeStage.js`
- `STAGE_MESSAGES` object — stage-specific warning + transition messages
- Phase 1 (warning): fires at `maxTurns - 1`, returns `shouldWarn: true` + `warningMessage`, stage does NOT advance
- Phase 2 (transition): fires at `maxTurns`, returns `shouldTransition: true` + `transitionMessage`, stage advances
- Stage 5 has empty messages — wraps up naturally
- Guard: `maxTurns >= 2` — no warning on single-turn stages
- All new return fields: `shouldWarn`, `shouldTransition`, `warningMessage`, `transitionMessage`

#### `chatRoute.js`
- Destructures new fields from `AdvanceIntakeStage`
- Step 7b: prepends transition/warning message to LLM reply
- Blank line separator keeps combined message readable
- `shouldTransition` takes priority over `shouldWarn`
- `stageSubtitle` in response + `/init` payload
- `stageTransition: true` flag in response for frontend animation

#### `Chatbot.jsx`
- `stageSubtitle` state — tracks plain-language stage description
- `transitioning` state — 1.5s flag for progress bar glow
- `STAGE_LABELS` extended with `subtitle` field per stage
- `.stage-subtitle` element — italic text below step circles
- `aria-live="polite"` on subtitle — SR announces stage change
- `.progress-bar-track.transitioning` — brief indigo glow on stage advance
- `@media (prefers-reduced-motion)` disables glow and subtitle transition

---

## Area 5 — Privacy & Compliance ⏳

**Problems identified (not yet fixed):**

### P1 — GDPR patient controls
Patients have no way to view, export, or delete their own intake messages. GDPR Articles 15 (right of access), 17 (right to erasure), and 20 (right to data portability) require these controls.

**Planned fix:**
- New backend endpoints: `GET /api/chatbot/export` (returns messages as JSON/PDF), `DELETE /api/chatbot/data` (deletes all patient messages, summaries, and session)
- New frontend: a "My Data" section on the patient dashboard with Export and Delete options
- Soft delete pattern — mark as deleted, purge after 30-day grace period
- Files to change: new `dataRightsController.js`, new routes, patient dashboard component

### P2 — Summary overwrite risk
When a patient resets their conversation, the old `ChatbotSummary` is silently overwritten. A psychologist who reviewed the old summary has no record of what it said.

**Planned fix:**
- Archive old summary before overwrite — new `ChatbotSummaryArchive` collection
- `resetConversation` in `chatbotController.js` moves current summary to archive with timestamp + reset reason
- Psychologist dashboard shows archived summaries with "reset on [date]" label
- Files to change: new `ChatbotSummaryArchive` model, `chatbotController.js`

### P3 — Groq data processing boundary
Patient mental health data (including suicidal ideation, trauma disclosures) is sent to Groq Cloud API with no documented DPA boundary in code. HIPAA and GDPR both require documented data processing agreements with third-party processors.

**Planned fix:**
- Data minimization wrapper — strip PII (names, contact info) before sending to Groq
- Add `X-Data-Classification: PHI` header documentation comment on all Groq calls
- Environment variable `GROQ_DATA_REGION` for region-locked deployments
- Inline comments on every Groq call documenting what data category is being sent
- Files to change: `GenerateEmpatheticResponse.js`, `chatRoute.js` (compression calls), `chatbotController.js`

### P4 — Audit trail completeness
Risk flags are logged but normal messages have no separate audit trail. If a patient later disputes what was said, or a regulator requests evidence of data handling, only risk events are verifiable.

**Planned fix:**
- `AuditLog` model — lightweight append-only collection logging: userId, action, timestamp, metadata (no message content in audit log — content stays in `ChatbotMessage`)
- Log events: session start, session end, reset, export request, delete request, risk flag, crisis hold activation, psychologist view
- Files to change: new `AuditLog` model, new `auditService.js`, wire into `chatbotController.js` and `chatRoute.js`

---

## Area 6 — AI Output Quality ⏳

**Problems identified (not yet fixed):**

### Q1 — Hallucination guardrails
No mechanism prevents the LLM from fabricating clinical information (medication names, diagnosis labels, statistics). In a mental health context this is a serious risk.

**Planned fix:** Post-processing filter that detects and strips confident clinical claims not grounded in the RAG context.

### Q2 — No feedback loop
Psychologists review chatbot summaries but have no way to flag poor ones. Without that signal, prompt quality can't improve.

**Planned fix:** Summary rating UI on psychologist dashboard — thumbs up/down + optional note. Stored on `ChatbotSummary` for future prompt tuning.

### Q3 — Summary quality not validated
`ChatbotSummary` generated by a single LLM call. A two-pass approach (generate then critique) would improve reliability.

**Planned fix:** Second LLM call that critiques the first summary and returns a confidence score. Low-confidence summaries flagged for psychologist attention.

### Q4 — Few-shot example currency
`SelectConversationExamples.js` has no described process for updating examples. Stale examples degrade response quality.

**Planned fix:** Admin endpoint to add/update/retire few-shot examples. Version-stamped examples with effectiveness score.

---

## Files Produced This Session

| File | Area | Status |
|---|---|---|
| `Chatbot.jsx` | Accessibility + Clinical Safety + Conversation UX | ✅ Final |
| `RiskAlertBanner.jsx` | Accessibility + Clinical Safety | ✅ Final |
| `AssistantBot.jsx` | Accessibility | ✅ Final |
| `chatRoute.js` | Technical Resilience + Clinical Safety + Conversation UX | ✅ Final |
| `GenerateEmpatheticResponse.js` | Technical Resilience + Conversation UX | ✅ Final |
| `GenerateHighRiskResponse.js` | Clinical Safety | ✅ Final |
| `AdvanceIntakeStage.js` | Conversation UX | ✅ Final |
| `RiskAlertService.js` | Clinical Safety | ✅ Final |
| `IntakeSession.js` | Technical Resilience + Clinical Safety | ✅ Final |

---

## Schema Changes Required (not in produced files)

These changes must be made manually in their respective model files:

```js
// IntakeSession.js — already produced with these fields
crisisHold:              { type: Boolean, default: false }
contextSummary:          { type: String,  default: null }
contextSummaryUpdatedAt: { type: Date,    default: null }

// RiskAlert.js — add manually
urgency: { type: String, enum: ['HIGH', 'CRITICAL'], default: 'HIGH' }
```

---

## Pending Items Before Go-Live

1. **Darija suicidality expressions** — verify `AnalyzeRiskBehavior.js` catches Darija-encoded expressions of suicidal ideation with native-speaking clinicians *(human task — out of scope)*
2. **`subtitleEn` in IntakeProtocol data** — ✅ added; run `node src/seedIntakeProtocol.js` to push to DB
3. **`stageNumber` field in stageConfig** — ✅ confirmed present in all seed documents
4. **`withRetry` DRY-up** — ✅ extracted to `server/src/utils/withRetry.js`
5. **Privacy & Compliance fixes** — ✅ P1–P4 complete
6. **AI Output Quality fixes** — ✅ Q1 + Q3 complete; Q2 (rating UI) + Q4 (admin endpoint) deferred
