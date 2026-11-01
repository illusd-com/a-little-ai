# a little ai

Free online AI caller powered by **NVIDIA Step 5 Preview** (`stepfun-ai/step-5-preview`).

- No account required — just type a username and start chatting.
- Chat history lives in **Turso** and follows you across devices.
- Optional password turns your username into a protected **Agent**.
- Adjust model **reasoning effort** (low / medium / high).

## Style

Strictly follows the Taiwan INFO minimal black-and-white Art Deco aesthetic (warm paper background, Noto Serif / Playfair Display, no blue, no gradients).

## Setup

1. Create a free Turso database and copy URL + auth token.
2. Get an NVIDIA API key that can call `stepfun-ai/step-5-preview`.
3. Copy `.env.example` → `.env.local` and fill the values.
4. `npm install && npm run dev`

## Deploy (Vercel)

Set the three environment variables in the Vercel project settings, then deploy.

```
NVIDIA_API_KEY
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
```

## Stack

- Next.js 15 (App Router)
- Turso / libSQL
- NVIDIA Integrate API
- Pure CSS matching style.md
