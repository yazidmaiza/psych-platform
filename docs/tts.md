# Server-side TTS (Cloud) — English/Arabic fallback

When a device lacks SpeechSynthesis voices for a desired language (e.g. English/Arabic on some Android builds),
the client falls back to a server-side TTS pipeline.

## Endpoints

### Generate speech (signed URL)

`POST /api/tts/speak`

Body:
- `text` (string, required, max 1000 chars)
- `language` (`auto|en|ar`)
- `style` (`neutral|male|female`) — maps to provider voices
- `speed` (0.25–2.0)

Response:
- `{ url, expiresAt }` where `url` is a short-lived download link.

### Download (token)

`GET /api/tts/download?token=...`

No auth header required (token possession authorizes).

## Storage + caching

- Generated audio is cached on disk under private uploads: `tts_cache/...`
- Cache key is a SHA256 hash of `{provider, model, voice, language, style, speed, format, text}`.

## Security

- `/api/tts/speak` requires authentication.
- Downloads use short-lived signed tokens.
- Audit events are written for generation, cache hits, URL issuance, and downloads.

## Configuration

Env vars:
- `OPENAI_API_KEY` (required)
- `OPENAI_TTS_MODEL` (optional, default: `gpt-4o-mini-tts`)

Provider reference: OpenAI Audio Speech endpoint `POST /v1/audio/speech`. citeturn0search2

