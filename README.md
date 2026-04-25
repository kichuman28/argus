# Argus

Argus is a browser-based autonomous QA agent for hackathon teams and local-first product builders.

Tagline: "AI users that break your app, explain what failed, and prove the fix."

Most teams use AI to build faster. Argus uses AI to find what AI-built apps broke.

## Current Progress

- Reworked the home page into a launch-console experience instead of a generic SaaS landing page.
- Removed the prefilled demo URL; users now enter the real target they want Argus to test.
- Added an AI-only site brief inside "What Argus understood"; Argus does not fabricate a deterministic website description when OpenAI is unavailable or returns invalid output.
- Replaced card-style live logs with a terminal-style runner stream powered by persisted run events.
- Replaced the previous hardcoded sample patch diff with bug-derived patch guidance based on current bug cards, reproduction steps, and evidence.
- Refreshed the visual system with a darker command-center style, updated accent colors, stronger font stacks, and reusable shell/terminal surfaces.
- Validated the current implementation with `npm.cmd run typecheck` and `npm.cmd run lint`.

## What It Does

- Accepts a local, preview, or hosted website URL.
- Scouts the target app before testing and extracts headings, routes, links, buttons, forms, inputs, accessibility hints, and a discovery screenshot.
- Asks OpenAI for a concise site brief from discovery data and stores it with the run when available.
- Creates 8 website-aware synthetic QA personas, or 20 aggressive personas in Chaos Mode.
- Runs persona-driven browser checks with Playwright using viewport, form, click, keyboard, accessibility, console, and network probes.
- Captures screenshots under `public/runs/{runId}` and shows them in an evidence gallery.
- Stores runs, discovery data, personas, live events, scenario results, and bug cards in local SQLite.
- Uses OpenAI Responses API for the site brief, persona generation, and bug analysis when `OPENAI_API_KEY` is present.
- Falls back to deterministic personas and heuristic bug analysis when no API key is configured.
- Shows a terminal-style live runner stream in the UI while Playwright is working.
- Shows a "What Argus understood" section with discovery signals and the OpenAI-generated site brief when one was returned.
- Uses a sidebar dashboard with separate sections for Overview, Understanding, Bugs, Personas, Live logs, Evidence, and Patch.
- Lets you click evidence screenshots to open a larger lightbox view.
- Generates bug-derived patch guidance, with optional repo-path context via `ARGUS_REPO_PATH`.
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

`OPENAI_API_KEY` is required for the AI site brief in "What Argus understood". The site description does not fall back to fabricated deterministic text; if OpenAI is unavailable or returns invalid output, the UI shows that no AI site description was returned.

`OPENAI_API_KEY` is optional for the rest of the MVP run. Without it, Argus still runs with deterministic personas and heuristic bug cards.

`ARGUS_REPO_PATH` is optional. It points to the local source-code folder for the app being tested. Today it is used as patch-guidance context; the intended next step is repo-aware file inspection and more specific diffs.

Restart `npm run dev` after changing environment variables.

## How It Works

1. `POST /api/runs` creates a run in SQLite.
2. Argus opens the target URL with Playwright for a discovery pass.
3. Argus asks OpenAI for a concise website description based on the discovery signals.
4. Discovery data, including `aiDescription` when available, is stored on the run and shown in the Understanding section.
5. Argus asks OpenAI for structured personas when an API key is available.
6. If OpenAI is unavailable or returns invalid persona output, Argus uses discovery-aware fallback personas.
7. `POST /api/runs/[id]/start` launches the in-memory Playwright runner.
8. The dashboard polls `GET /api/runs/[id]` every 1.5 seconds.
9. Runner events are written to SQLite and shown in the terminal-style Live logs stream.
10. Scenario results and screenshots are stored after each persona finishes.
11. OpenAI or heuristic analysis turns traces into bug cards.
12. `Generate patch` produces bug-derived patch guidance from current bug cards, reproduction steps, and evidence.
13. `Verify fix` reruns failed scenarios and marks bugs fixed or still failing.

## Dashboard Sections

- `Overview`: status cards, terminal runner stream, compact understanding summary, and latest evidence.
- `Understanding`: discovery signals plus the OpenAI-generated site brief when available.
- `Bugs`: severity, category, reproduction steps, evidence, and suggested fixes.
- `Personas`: generated synthetic users and their goals.
- `Live logs`: terminal-style event stream from discovery through scenario execution.
- `Evidence`: screenshot gallery for discovery and persona runs.
- `Patch`: bug-derived patch guidance based on the current findings.

## Demo Flow

1. Enter the real target URL, such as a local app URL or hosted preview.
2. Choose `Standard` for 8 personas or `Chaos` for 20 aggressive personas.
3. Click `Launch`.
4. Argus scouts the target app, asks OpenAI for the site brief, and creates website-aware personas.
5. Watch the dashboard update every 1.5 seconds.
6. Use `Overview` or `Live logs` to watch the terminal-style runner stream.
7. Open `Understanding` to review discovery signals and the AI site brief when OpenAI returned one.
8. Open `Bugs` to review severity, reproduction steps, evidence, and suggested fixes.
9. Open `Evidence` and click screenshots to inspect them in a larger view.
10. Click `Generate patch` for bug-derived patch guidance.
11. Click `Verify fix` after changing the target app to rerun failed scenarios.

## Developer Observability

The dev server prints logs for the main AI and runner decisions:

```txt
[Argus Run] created normal run
[Argus Discovery] scouting target site
[Argus Discovery] asking AI for site description
[Argus Personas] generating personas
[Argus AI] Site description: using OpenAI output
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
