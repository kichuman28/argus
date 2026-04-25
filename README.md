# Argus

Argus is a browser-based autonomous QA agent for hackathon teams and local-first product builders.

Tagline: "AI users that break your app, explain what failed, and prove the fix."

Most teams use AI to build faster. Argus uses AI to find what AI-built apps broke.

## What It Does

- Accepts a local, preview, or hosted website URL.
- Scouts the target app before testing and extracts headings, routes, links, buttons, forms, inputs, accessibility hints, and a discovery screenshot.
- Creates 8 website-aware synthetic QA personas, or 20 aggressive personas in Chaos Mode.
- Runs persona-driven browser checks with Playwright using viewport, form, click, keyboard, accessibility, console, and network probes.
- Captures screenshots under `public/runs/{runId}` and shows them in an evidence gallery.
- Stores runs, discovery data, personas, live events, scenario results, and bug cards in local SQLite.
- Uses OpenAI Responses API for persona generation and bug analysis when `OPENAI_API_KEY` is present.
- Falls back to deterministic personas and heuristic bug analysis when no API key is configured.
- Shows live runner logs in the UI while Playwright is working.
- Shows a "What Argus understood" section so users can see the discovery signals used to plan the run.
- Uses a sidebar dashboard with separate sections for Overview, Understanding, Bugs, Personas, Live logs, Evidence, and Patch.
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

Copy `.env.example` to `.env.local` or `.env` if you want AI-enhanced output:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
ARGUS_REPO_PATH=C:\path\to\your\target-app
```

`OPENAI_API_KEY` is optional. Without it, Argus still runs with deterministic personas and heuristic bug cards.

`ARGUS_REPO_PATH` is optional. It points to the local source-code folder for the app being tested. Today it is used as patch-suggestion context; the intended next step is repo-aware file inspection and more specific diffs.

Restart `npm run dev` after changing environment variables.

## How It Works

1. `POST /api/runs` creates a run in SQLite.
2. Argus opens the target URL with Playwright for a discovery pass.
3. Discovery data is stored on the run and shown in the Understanding section.
4. Argus asks OpenAI for structured personas when an API key is available.
5. If OpenAI is unavailable or returns invalid output, Argus uses discovery-aware fallback personas.
6. `POST /api/runs/[id]/start` launches the in-memory Playwright runner.
7. The dashboard polls `GET /api/runs/[id]` every 1.5 seconds.
8. Runner events are written to SQLite and shown in Live logs.
9. Scenario results and screenshots are stored after each persona finishes.
10. OpenAI or heuristic analysis turns traces into bug cards.
11. `Generate patch` produces PR-style repair guidance.
12. `Verify fix` reruns failed scenarios and marks bugs fixed or still failing.

## Dashboard Sections

- `Overview`: status cards, progress, latest activity, compact understanding summary, and latest evidence.
- `Understanding`: what Argus discovered about the website before testing.
- `Bugs`: severity, category, reproduction steps, evidence, and suggested fixes.
- `Personas`: generated synthetic users and their goals.
- `Live logs`: UI-visible runner stream from discovery through scenario execution.
- `Evidence`: screenshot gallery for discovery and persona runs.
- `Patch`: generated PR-style patch guidance.

## Demo Flow

1. Enter a URL, for example `https://example.com` or a local app URL.
2. Click `Launch Argus` for the default 8 personas.
3. Click `Chaos Mode` for 20 edge-case personas.
4. Argus scouts the target app and creates website-aware personas.
5. Watch the sidebar dashboard update every 1.5 seconds.
6. Open `Understanding` to see what Argus learned about the target app.
7. Open `Live logs` to watch browser-runner events in the UI.
8. Open `Bugs` to review severity, reproduction steps, evidence, and suggested fixes.
9. Open `Evidence` and click screenshots to inspect them in a larger view.
10. Click `Generate patch` for PR-style repair guidance.
11. Click `Verify fix` after changing the target app to rerun failed scenarios.

## Developer Observability

The dev server prints logs for the main AI and runner decisions:

```txt
[Argus Run] created normal run
[Argus Discovery] scouting target site
[Argus Personas] generating personas
[Argus AI] argus_personas: requesting structured output
[Argus AI] Personas: using OpenAI output
[Argus Runner] running persona
[Argus Analysis] saved bug cards
```

Fallback paths are also logged, for example:

```txt
[Argus AI] argus_personas: OPENAI_API_KEY missing, skipping OpenAI.
[Argus AI] Personas: using discovery-aware fallback.
[Argus AI] Bug analysis: OpenAI output was missing or invalid, using heuristic analysis.
```

## Notes

- The runner is intentionally in-memory for MVP speed. It is not a production queue.
- SQLite is stored at `argus.sqlite`.
- Screenshots are ignored by git via `public/runs`.
- Live logs are persisted in SQLite as run events.
- Some arbitrary public sites block automation, cookies, or scripts. Argus records those failures and keeps the report demo-ready.
