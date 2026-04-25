# Argus

Argus is a browser-based autonomous QA agent for hackathon teams.

Tagline: "AI users that break your app, explain what failed, and prove the fix."

Most teams use AI to build faster. Argus uses AI to find what AI-built apps broke.

## What It Does

- Accepts a website URL.
- Creates 8 default synthetic QA personas, or 20 aggressive personas in Chaos Mode.
- Runs persona-driven browser checks with Playwright.
- Captures screenshots under `public/runs/{runId}`.
- Stores runs, personas, scenario results, and bug cards in local SQLite.
- Uses OpenAI Responses API for persona generation and bug analysis when `OPENAI_API_KEY` is present.
- Falls back to deterministic personas and heuristic bug analysis when no API key is configured.
- Scouts the target app before testing and uses headings, routes, buttons, forms, and accessibility hints to tailor personas.
- Shows a live event feed and latest screenshot while the runner is working.
- Lets you click evidence screenshots to open a larger lightbox view.
- Generates PR-style patch suggestions, with optional repo-path context via `ARGUS_REPO_PATH`.
- Reruns failed scenarios through "Verify fix".

## Setup

```bash
npm install
npx playwright install
npm run dev
```

On Windows PowerShell, if `npm` is blocked by execution policy, use:

```bash
npm.cmd install
npx.cmd playwright install
npm.cmd run dev
```

Open http://localhost:3000.

## Environment

Copy `.env.example` to `.env.local` if you want AI-enhanced output:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
ARGUS_REPO_PATH=C:\path\to\your\app
```

`OPENAI_API_KEY` is optional. Without it, Argus still runs with deterministic personas and heuristic bug cards.

## Demo Flow

1. Enter a URL, for example `https://example.com` or a local app URL.
2. Click `Launch Argus` for the default 8 personas.
3. Click `Chaos Mode` for 20 edge-case personas.
4. Argus scouts the target app and creates website-aware personas.
5. Watch the live event feed and latest screenshot update every 1.5 seconds.
6. Review personas, passed/failed flows, screenshots, severity badges, reproduction steps, suggested fixes, and patch text.
7. Click screenshots to inspect evidence in a larger view.
8. Click `Verify fix` after changing the target app to rerun failed scenarios.

## Notes

- The runner is intentionally in-memory for MVP speed. It is not a production queue.
- SQLite is stored at `argus.sqlite`.
- Screenshots are ignored by git via `public/runs`.
- Some arbitrary public sites block automation, cookies, or scripts. Argus records those failures and keeps the report demo-ready.
