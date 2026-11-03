# OpenRouter provider integration

This branch adds a server-side OpenRouter API adapter for chat, image generation, and asynchronous video generation.

## Configure locally

1. Create a key at https://openrouter.ai/keys.
2. Put it in the server environment only:

```dotenv
OPENROUTER_API_KEY=sk-or-your-new-key
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_SITE_NAME=OpenHiggsfield Studio
```

3. Restart the Next.js server after changing environment variables.

Do not commit `.env`, do not use a `NEXT_PUBLIC_` prefix, and do not paste the key into GitHub or chat.

## Adapter

Import `createOpenRouterClient` from `src/generation/openrouter.ts` inside server-only code. It supports:

- `chat({ model, messages })` via `POST /chat/completions`
- `generateImage({ model, prompt, ... })` via `POST /images`
- `createVideo({ model, prompt, ... })`, then `getVideoJob(jobId)` to poll
- `downloadVideo(jobId)` to stream the completed MP4

Image and video models, input formats, aspect ratios, durations, and pricing vary. Query the OpenRouter model catalogs and validate capabilities before presenting options or submitting paid jobs.

This adapter is intentionally separate from the existing Higgsfield client. The current UI and its model catalog still need a provider selector and OpenRouter-specific model/settings controls before this provider is available end-to-end in the studio.
