# ForgetMeNot
Hacks for humanity Submission

## Interactive demo

A desktop-first, responsive family legacy prototype. All families, stories, transcripts, answers, and voice trends are illustrative. No backend, authentication, payments, real recording, AI, or medical analysis is implemented.

## Run

Use Node.js 18+ and run `npm install` then `npm run dev`. Open the URL printed by the server. `npm run build` checks JavaScript syntax; the deployable site is already in `dist/`.

## Demo sequence

1. Landing page → **Open the family archive**.
2. **Open our app** → **Tell my story** → **Finish my story**. Recording and transcript are simulated.
3. **Ask the archive** → **How did Grandpa meet Grandma?** → **Where was the wedding?** → source clip.
4. Ask about a favorite movie → no answer → **Ask Grandpa next time** → **Question queue**.
5. Explore **Stories**, **Scrapbook**, and **Family tree**.
6. **Voice patterns** for Raj (Typical), then switch the scenario to Gradual change. Use the date slider to watch the baseline build and the status change. All values come from a seeded generator and are clinically unvalidated.
7. **Privacy & access** → toggle timeline consent off; check that the timeline is hidden. Export downloads demo transcripts and metadata.

## Edit for your presentation

- `dist/mock-data.js`: `brand`, two `personas`, stories, transcripts, scrapbook events, family members, source timestamps, and initial questions.
- `dist/app.js`: `answerFor()` is the deterministic Q&A fixture; update it when changing transcripts so every answer remains supported. `landing()` controls marketing copy. All screens and interaction handlers are in this file.
- `dist/styles.css`: palette, typography, desktop layout, mobile breakpoints.
- `dist/assets/flower.svg`: brand icon.

## Original audio

Put your recorded files in `dist/assets/audio/`. Set a story's `audio` field in `mock-data.js` to `assets/audio/love.mp3`, for example. Use `sourceStart` and `sourceEnd` in seconds to match the real clip. For a short standalone clip, set the source start to `0` and end to its actual duration. Empty `audio` fields use a clearly labelled silent playback simulation. The demo never synthesizes a grandparent's voice.

ElevenLabs is not connected; no credentials are needed. A prerecorded interviewer prompt can be added later. Never put API keys in browser code.

## Vercel

Import this source folder into a Git repository and deploy it on Vercel with **Other** as the framework, `npm run build` as the build command, and `dist` as the output directory. `vercel.json` provides these defaults. There is no server runtime requirement. The currently hosted demo uses Sites.

## Prototype limitations

Changes live in browser memory and reset on reload. Permissions simulate product behavior and do not secure a real archive. No private user data should be entered. Voice patterns come from a seeded demo generator, do not derive from audio, and do not indicate health status. The 14-recording baseline is a product rule shown in the demo, not a validated minimum. Sample photography is illustrative and sourced from Unsplash.
