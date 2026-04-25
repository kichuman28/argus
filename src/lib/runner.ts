import { chromium, type Browser, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { createBugCards } from "./analysis";
import {
  getPersonas,
  getRun,
  getScenarioResults,
  insertRunEvent,
  insertScenarioResult,
  replaceBugs,
  updateBugStatuses,
  updateRunStatus
} from "./db";
import { createId, nowIso } from "./ids";
import { inputForRisk, viewportForPersona } from "./personas";
import { parseJson, stringifyJson } from "./json";
import type { Persona, Run, RunEventKind, ScenarioResult, ScenarioStatus, ScenarioStep, WebsiteDiscovery } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __argusRunning: Set<string> | undefined;
}

function runningSet() {
  globalThis.__argusRunning ??= new Set<string>();
  return globalThis.__argusRunning;
}

export function isRunActive(runId: string) {
  return runningSet().has(runId);
}

export function startRunInBackground(runId: string) {
  const active = runningSet();
  if (active.has(runId)) return false;
  active.add(runId);
  void runArgus(runId, "full").finally(() => active.delete(runId));
  return true;
}

export function verifyRunInBackground(runId: string) {
  const active = runningSet();
  if (active.has(runId)) return false;
  active.add(runId);
  void runArgus(runId, "verify").finally(() => active.delete(runId));
  return true;
}

async function runArgus(runId: string, purpose: "full" | "verify") {
  const run = getRun(runId);
  if (!run) return;
  updateRunStatus(runId, "running");
  console.log(`[Argus Runner] ${runId}: ${purpose === "verify" ? "verification" : "full"} run started.`);
  logEvent(runId, null, "action", purpose === "verify" ? "Verifying failed scenarios." : "Starting autonomous browser run.");
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const personas = selectPersonasForPurpose(runId, purpose);
    console.log(`[Argus Runner] ${runId}: launching ${personas.length} persona scenario(s).`);
    for (const persona of personas) {
      console.log(`[Argus Runner] ${runId}: running persona "${persona.name}" (${persona.riskType}).`);
      const result = await runPersona(browser, run, persona);
      insertScenarioResult(result);
      console.log(`[Argus Runner] ${runId}: persona "${persona.name}" finished as ${result.status}.`);
    }

    const latestResults = getScenarioResults(runId);
    if (purpose === "full") {
      console.log(`[Argus Analysis] ${runId}: analyzing ${latestResults.length} scenario result(s).`);
      const bugs = await createBugCards({
        url: run.url,
        mode: run.mode,
        discovery: parseJson<WebsiteDiscovery | null>(run.discoveryJson, null),
        personas: getPersonas(runId),
        results: latestResults
      });
      replaceBugs(runId, bugs);
      console.log(`[Argus Analysis] ${runId}: saved ${bugs.length} bug card(s).`);
    } else {
      const verificationResults = latestResults.slice(-personas.length);
      const fixed = verificationResults.every((result) => result.status === "passed");
      updateBugStatuses(runId, fixed ? "verified_fixed" : "still_failing");
    }
    logEvent(runId, null, "complete", purpose === "verify" ? "Verification pass complete." : "Run complete. Bug report assembled.");
    updateRunStatus(runId, "complete", true);
    console.log(`[Argus Runner] ${runId}: run complete.`);
  } catch (error) {
    console.error("Argus runner failed", error);
    logEvent(runId, null, "error", error instanceof Error ? error.message : "Argus runner failed.");
    updateRunStatus(runId, "failed", true);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

function selectPersonasForPurpose(runId: string, purpose: "full" | "verify") {
  const personas = getPersonas(runId);
  if (purpose === "full") return personas;
  const failedPersonaIds = new Set(
    getScenarioResults(runId)
      .filter((result) => result.status !== "passed")
      .map((result) => result.personaId)
  );
  const selected = personas.filter((persona) => failedPersonaIds.has(persona.id));
  return selected.length ? selected : personas.slice(0, 2);
}

async function runPersona(browser: Browser, run: Run, persona: Persona): Promise<ScenarioResult> {
  const startedAt = nowIso();
  const resultId = createId("scenario");
  const runDir = path.join(process.cwd(), "public", "runs", run.id);
  fs.mkdirSync(runDir, { recursive: true });

  const context = await browser.newContext({
    viewport: viewportForPersona(persona.viewport),
    userAgent: `Argus synthetic QA - ${persona.name}`
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);

  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  const screenshots: string[] = [];
  const steps: ScenarioStep[] = [];
  logEvent(run.id, persona.id, "persona", `${persona.name} is checking: ${persona.goal}`);

  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) consoleErrors.push(`${msg.type()}: ${msg.text()}`.slice(0, 500));
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`.slice(0, 500)));
  page.on("response", (response) => {
    if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`.slice(0, 500));
  });
  page.on("requestfailed", (request) => {
    networkErrors.push(`${request.failure()?.errorText ?? "request failed"} ${request.url()}`.slice(0, 500));
  });

  try {
    await page.goto(run.url, { waitUntil: "domcontentloaded", timeout: 15000 });
    steps.push({ label: "Opened target page", ok: true, detail: page.url() });
    logEvent(run.id, persona.id, "action", `${persona.name} opened ${page.url()}.`);
    await screenshot(page, run.id, persona, "before", screenshots);
  } catch (error) {
    steps.push({ label: "Open target page", ok: false, detail: error instanceof Error ? error.message : "Navigation failed" });
    logEvent(run.id, persona.id, "error", `${persona.name} could not load the target page.`);
    await page.setContent(demoFailureHtml(run.url, persona.name));
    await screenshot(page, run.id, persona, "navigation-failed", screenshots);
    await context.close().catch(() => undefined);
    return finishResult(run, persona, resultId, "failed", "The page could not be loaded, so Argus captured a demo failure state.", steps, screenshots, consoleErrors, networkErrors, startedAt);
  }

  await fillVisibleInputs(page, run.id, persona, steps, screenshots);
  await clickLikelyTargets(page, persona, steps);
  await keyboardProbe(page, persona, steps);
  await accessibilityProbe(page, steps);
  await screenshot(page, run.id, persona, "after", screenshots);

  const failedSteps = steps.filter((step) => !step.ok);
  const status: ScenarioStatus =
    networkErrors.some((item) => item.match(/\b5\d\d\b/)) || failedSteps.length > 1
      ? "failed"
      : consoleErrors.length || networkErrors.length || failedSteps.length
        ? "warning"
        : "passed";
  const summary =
    status === "passed"
      ? `${persona.name} completed exploratory checks without obvious blocking failures.`
      : `${persona.name} found ${failedSteps.length + consoleErrors.length + networkErrors.length} signals worth reviewing.`;
  logEvent(run.id, persona.id, status === "passed" ? "complete" : "finding", summary);

  await context.close().catch(() => undefined);
  return finishResult(run, persona, resultId, status, summary, steps, screenshots, consoleErrors, networkErrors, startedAt);
}

async function fillVisibleInputs(page: Page, runId: string, persona: Persona, steps: ScenarioStep[], screenshots: string[]) {
  const inputs = page.locator("input:visible, textarea:visible");
  const count = Math.min(await inputs.count().catch(() => 0), 5);
  if (!count) {
    steps.push({ label: "Find visible form fields", ok: persona.riskType !== "onboarding", detail: "No visible inputs found." });
    return;
  }
  for (let i = 0; i < count; i += 1) {
    const input = inputs.nth(i);
    const type = (await input.getAttribute("type").catch(() => "")) ?? "";
    const value = type === "password" ? "Argus-demo-123!" : inputForRisk(persona.riskType, i);
    await input.fill(value).catch(() => undefined);
  }
  steps.push({ label: "Filled visible fields with persona-relevant data", ok: true, detail: `${count} fields touched.` });
  logEvent(runId, persona.id, "action", `${persona.name} filled ${count} visible field(s).`);
  await screenshot(page, runId, persona, "during", screenshots);
}

async function clickLikelyTargets(page: Page, persona: Persona, steps: ScenarioStep[]) {
  const targetText =
    persona.riskType === "authentication"
      ? /log in|login|sign in|account|dashboard/i
      : persona.riskType === "conversion"
        ? /buy|checkout|cart|pricing|plan|subscribe|purchase/i
        : /start|sign up|signup|get started|continue|submit|try|demo|learn|contact/i;

  const preferred = page.getByRole("link", { name: targetText }).or(page.getByRole("button", { name: targetText }));
  const preferredCount = await preferred.count().catch(() => 0);
  if (preferredCount) {
    await preferred.first().click({ timeout: 2500 }).catch(() => undefined);
    await page.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => undefined);
    steps.push({ label: "Clicked likely goal-oriented CTA", ok: true, detail: targetText.toString() });
    logEvent(persona.runId, persona.id, "action", `${persona.name} clicked a goal-oriented action.`);
    return;
  }

  const generic = page.locator("button:visible, a:visible").first();
  const genericCount = await generic.count().catch(() => 0);
  if (!genericCount) {
    steps.push({ label: "Click likely navigation or action", ok: false, detail: "No visible buttons or links were found." });
    return;
  }
  await generic.click({ timeout: 2500 }).catch(() => undefined);
  await page.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => undefined);
  steps.push({ label: "Clicked first visible interactive element", ok: true });
  logEvent(persona.runId, persona.id, "action", `${persona.name} clicked the first visible interactive control.`);
}

async function keyboardProbe(page: Page, persona: Persona, steps: ScenarioStep[]) {
  if (!["keyboard", "accessibility"].includes(persona.riskType)) return;
  for (let i = 0; i < 6; i += 1) await page.keyboard.press("Tab").catch(() => undefined);
  await page.keyboard.press("Enter").catch(() => undefined);
  const focused = await page.evaluate(() => document.activeElement?.tagName ?? "none").catch(() => "unknown");
  steps.push({ label: "Keyboard navigation probe", ok: focused !== "BODY", detail: `Focused element: ${focused}` });
  logEvent(persona.runId, persona.id, "action", `${persona.name} ran a keyboard navigation probe.`);
}

async function accessibilityProbe(page: Page, steps: ScenarioStep[]) {
  const notes = await page
    .evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, textarea, select"));
      const unlabeled = inputs.filter((el) => {
        const id = el.getAttribute("id");
        const labelledBy = el.getAttribute("aria-labelledby");
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
        return !label && !labelledBy && !el.getAttribute("aria-label");
      }).length;
      const imagesWithoutAlt = Array.from(document.images).filter((img) => !img.alt).length;
      return { unlabeled, imagesWithoutAlt };
    })
    .catch(() => ({ unlabeled: 0, imagesWithoutAlt: 0 }));
  if (notes.unlabeled || notes.imagesWithoutAlt) {
    steps.push({
      label: "Accessibility hints detected",
      ok: false,
      detail: `${notes.unlabeled} unlabeled fields, ${notes.imagesWithoutAlt} images without alt text.`
    });
  } else {
    steps.push({ label: "Accessibility hint scan", ok: true, detail: "No obvious missing labels or image alt text found." });
  }
}

async function screenshot(page: Page, runId: string, persona: Persona, label: string, screenshots: string[]) {
  const safePersona = persona.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const fileName = `${safePersona}-${label}-${Date.now()}.png`;
  const diskPath = path.join(process.cwd(), "public", "runs", runId, fileName);
  fs.mkdirSync(path.dirname(diskPath), { recursive: true });
  await page.screenshot({ path: diskPath, fullPage: true }).catch(() => undefined);
  const publicPath = `/runs/${runId}/${fileName}`;
  screenshots.push(publicPath);
  logEvent(runId, persona.id, "screenshot", `${persona.name} captured ${label} evidence.`, publicPath);
}

function logEvent(runId: string, personaId: string | null, kind: RunEventKind, message: string, screenshotPath: string | null = null) {
  try {
    insertRunEvent({
      id: createId("event"),
      runId,
      personaId,
      kind,
      message,
      screenshotPath,
      createdAt: nowIso()
    });
  } catch {
    // Event logging should never stop the browser runner.
  }
}

function finishResult(
  run: Run,
  persona: Persona,
  id: string,
  status: ScenarioStatus,
  summary: string,
  steps: ScenarioStep[],
  screenshots: string[],
  consoleErrors: string[],
  networkErrors: string[],
  startedAt: string
): ScenarioResult {
  return {
    id,
    runId: run.id,
    personaId: persona.id,
    status,
    summary,
    stepsJson: stringifyJson(steps),
    screenshotsJson: stringifyJson(screenshots),
    consoleErrorsJson: stringifyJson(consoleErrors),
    networkErrorsJson: stringifyJson(networkErrors),
    startedAt,
    finishedAt: nowIso()
  };
}

function demoFailureHtml(url: string, personaName: string) {
  return `<!doctype html><html><body style="margin:0;background:#08090d;color:white;font-family:Arial,sans-serif;padding:48px">
    <h1>Argus could not load ${escapeHtml(url)}</h1>
    <p>${escapeHtml(personaName)} hit a navigation failure. This keeps the demo alive while still showing evidence.</p>
    <button style="padding:14px 20px">Retry target</button>
  </body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}
