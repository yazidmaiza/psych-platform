# Server-side TTS (Cloud) — English/Arabic fallback

When a device lacks SpeechSynthesis voices for a desired language (e.g. English/Arabic on some Android builds),
the client falls back to a server-side TTS pipeline.

## Endpoints

### Generate speech (signed URL)

`POST /api/tts/speak`

Body:
- `text` (string, required, max 8000 chars; Orpheus is chunked at 200 chars/request server-side)
- `language` (`auto|en|fr|ar`)
- `style` (`neutral|male|female`) — maps to provider voices
- `speed` (0.25–2.0)
- `correctText` (boolean, optional) — if true, the server will correct spelling/grammar before TTS (best-effort)
- `voice` (string, optional) — provider voice id override
- `sampleRate` (number, optional) — provider sample rate hint

Response:
- `{ url, expiresAt }` where `url` is a short-lived download link.

### Download (token)

`GET /api/tts/download?token=...`

No auth header required (token possession authorizes).

## Storage + caching

- Generated audio is cached on disk under private uploads: `tts_cache/...`
- Cache key is a SHA256 hash of `{provider, model, voice, language, style, speed, format, sampleRate, text}`.

## Security

- `/api/tts/speak` requires authentication.
- Downloads use short-lived signed tokens.
- Audit events are written for generation, cache hits, URL issuance, and downloads.

## Configuration

Env vars:
- `GROQ_API_KEY` (required)
- `GROQ_TTS_MODEL` (optional, default: `canopylabs/orpheus-v1-english` or `canopylabs/orpheus-arabic-saudi` when `language=ar`)
- `GROQ_TTS_FORMAT` (optional, default: `mp3`)
- `GROQ_TTS_CORRECT_TEXT` (optional, default: `false`) — enable correction by default
- `GROQ_TEXT_CORRECT_MODEL` (optional, default: `llama-3.1-8b-instant`)
- `GROQ_TTS_FALLBACK_MODEL` (optional, default: empty) — only used for non-terms-related failures; note that deprecated models (e.g. `playai-tts`) will not work
- `GROQ_TTS_FALLBACK_FORMAT` (optional, default: `mp3`)

Provider reference: Groq OpenAI-compatible Audio Speech endpoint `POST /openai/v1/audio/speech`.
