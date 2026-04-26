import { parseJson } from "./json";
import type { Bug, Persona, RunBundle, ScenarioResult, ScenarioStep, WebsiteDiscovery } from "./types";
import { argusPath } from "./paths";

const severityWeight: Record<Bug["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

type EvidencePayload = {
  summary?: string;
  consoleErrors?: string[];
  networkErrors?: string[];
  screenshots?: string[];
};

type ScreenshotReference = {
  publicPath: string;
  publicUrl: string;
  localPath: string | null;
};

export function buildRunReport(bundle: RunBundle) {
  const discovery = parseJson<WebsiteDiscovery | null>(bundle.run.discoveryJson, null);
  const statusSummary = summarizeResults(bundle.results);

  return {
    run: {
      id: bundle.run.id,
      url: bundle.run.url,
      mode: bundle.run.mode,
      status: bundle.run.status,
      createdAt: bundle.run.createdAt,
      finishedAt: bundle.run.finishedAt
    },
    discovery: discovery
      ? {
          title: discovery.title,
          description: discovery.description,
          aiDescription: discovery.aiDescription,
          routes: discovery.routes,
          buttons: discovery.buttons,
          forms: discovery.forms,
          keywords: discovery.keywords,
          accessibilityHints: discovery.accessibilityHints,
          screenshot: discovery.screenshotPath ? toScreenshotReference(discovery.screenshotPath) : null
        }
      : null,
    statusSummary,
    personas: bundle.personas.map((persona) => ({
      id: persona.id,
      name: persona.name,
      goal: persona.goal,
      behavior: persona.behavior,
      viewport: persona.viewport,
      riskType: persona.riskType
    })),
    results: bundle.results.map((result) => formatScenarioResult(result)),
    bugs: sortBugsByPriority(bundle.bugs).map((bug) => formatBugReportItem(bug, bundle.personas)),
    evidence: collectEvidence(bundle),
    verification: {
      openBugs: bundle.bugs.filter((bug) => bug.status === "open").length,
      verifiedFixed: bundle.bugs.filter((bug) => bug.status === "verified_fixed").length,
      stillFailing: bundle.bugs.filter((bug) => bug.status === "still_failing").length
    }
  };
}

export function buildBugReport(bundle: RunBundle) {
  return {
    runId: bundle.run.id,
    targetUrl: bundle.run.url,
    bugs: sortBugsByPriority(bundle.bugs).map((bug) => formatBugReportItem(bug, bundle.personas))
  };
}

export function buildFixBrief(bundle: RunBundle) {
  const discovery = parseJson<WebsiteDiscovery | null>(bundle.run.discoveryJson, null);
  const activeBugs = sortBugsByPriority(bundle.bugs.filter((bug) => bug.status !== "verified_fixed"));
  const bugs = activeBugs.length ? activeBugs : sortBugsByPriority(bundle.bugs);
  const statusSummary = summarizeResults(bundle.results);
  const discoveryLine = discovery
    ? [
        discovery.aiDescription || discovery.description || discovery.title,
        discovery.routes.length ? `Routes: ${discovery.routes.slice(0, 8).join(", ")}` : null,
        discovery.buttons.length ? `Visible actions: ${discovery.buttons.slice(0, 8).join(", ")}` : null
      ]
        .filter(Boolean)
        .join("\n")
    : "No discovery summary was stored for this run.";

  const findingText = bugs.length
    ? bugs.map((bug, index) => formatBugRepairSection(bug, index + 1, { personas: bundle.personas, includeLocalPaths: true })).join("\n\n")
    : "No bug cards are available for this run. Inspect the scenario results and rerun Argus if the target changed.";

  return `Argus Codex repair brief

Use this as QA context while Codex is working inside the target source repo. Argus does not edit the external repo; Codex should inspect, change, and verify files through the developer-controlled workspace.

Run:
- ID: ${bundle.run.id}
- Target: ${bundle.run.url}
- Mode: ${bundle.run.mode}
- Status: ${bundle.run.status}
- Created: ${bundle.run.createdAt}

Result summary:
- Passed: ${statusSummary.passed}
- Failed: ${statusSummary.failed}
- Warnings: ${statusSummary.warning}
- Total scenarios: ${statusSummary.total}

What Argus understood:
${discoveryLine}

Prioritized findings:
${findingText}

Verification guidance:
- Reproduce the relevant flow in the target app before editing when practical.
- Run the target repo's normal typecheck, lint, unit, or build commands after editing.
- Return to Argus and use Verify fix for run ${bundle.run.id} to rerun the failed personas against ${bundle.run.url}.`;
}

export function formatBugRepairSection(
  bug: Bug,
  index: number,
  options: { personas?: Persona[]; includeLocalPaths?: boolean } = {}
) {
  const persona = options.personas?.find((item) => item.id === bug.personaId);
  const steps = normalizeReproductionSteps(bug.reproductionStepsJson).slice(0, 7);
  const evidence = parseEvidence(bug.evidenceJson);
  const likelyAreas = inferLikelyAffectedAreas(bug, evidence);

  const evidenceLines = [
    evidence.summary ? `- Summary: ${evidence.summary}` : null,
    evidence.consoleErrors.length ? `- Console errors: ${evidence.consoleErrors.slice(0, 4).join(" | ")}` : null,
    evidence.networkErrors.length ? `- Network errors: ${evidence.networkErrors.slice(0, 4).join(" | ")}` : null,
    evidence.screenshots.length
      ? `- Screenshots: ${evidence.screenshots
          .slice(0, 4)
          .map((screenshot) =>
            options.includeLocalPaths && screenshot.localPath
              ? `${screenshot.publicPath} (${screenshot.localPath})`
              : screenshot.publicPath
          )
          .join(", ")}`
      : null
  ].filter(Boolean);

  return `### ${index}. [${bug.severity}] ${bug.title}
Bug ID: ${bug.id}
Category: ${bug.category}
Status: ${bug.status}
Persona: ${persona?.name ?? "General finding"}
Likely affected areas: ${likelyAreas.join("; ")}

Suggested fix:
${bug.suggestedFix}

Reproduction:
${steps.length ? steps.map((step, stepIndex) => `${stepIndex + 1}. ${step}`).join("\n") : "No structured reproduction steps were captured for this finding."}

Evidence:
${evidenceLines.length ? evidenceLines.join("\n") : "- No evidence payload was attached."}${
    bug.patchSuggestion
      ? `

Existing patch note:
${bug.patchSuggestion}`
      : ""
  }`;
}

export function normalizeReproductionSteps(value: string) {
  const parsed = parseJson<unknown>(value, value);
  return extractStepCandidates(parsed)
    .map((step) => step.replace(/^\s*\d+[\).\s-]+/, "").trim())
    .filter(Boolean)
    .filter((step, index, list) => list.indexOf(step) === index);
}

export function sortBugsByPriority(bugs: Bug[]) {
  return [...bugs].sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity] || a.title.localeCompare(b.title));
}

function formatScenarioResult(result: ScenarioResult) {
  return {
    id: result.id,
    personaId: result.personaId,
    status: result.status,
    summary: result.summary,
    steps: parseJson<ScenarioStep[]>(result.stepsJson, []),
    screenshots: parseJson<string[]>(result.screenshotsJson, []).map(toScreenshotReference),
    consoleErrors: parseJson<string[]>(result.consoleErrorsJson, []),
    networkErrors: parseJson<string[]>(result.networkErrorsJson, []),
    startedAt: result.startedAt,
    finishedAt: result.finishedAt
  };
}

function formatBugReportItem(bug: Bug, personas: Persona[]) {
  const persona = personas.find((item) => item.id === bug.personaId);
  const evidence = parseEvidence(bug.evidenceJson);
  return {
    id: bug.id,
    personaId: bug.personaId,
    personaName: persona?.name ?? null,
    title: bug.title,
    severity: bug.severity,
    category: bug.category,
    status: bug.status,
    reproductionSteps: normalizeReproductionSteps(bug.reproductionStepsJson),
    evidence,
    suggestedFix: bug.suggestedFix,
    patchSuggestion: bug.patchSuggestion,
    likelyAffectedAreas: inferLikelyAffectedAreas(bug, evidence)
  };
}

function summarizeResults(results: ScenarioResult[]) {
  return {
    total: results.length,
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    warning: results.filter((result) => result.status === "warning").length
  };
}

function parseEvidence(value: string) {
  const evidence = parseJson<EvidencePayload>(value, {});
  return {
    summary: typeof evidence.summary === "string" ? evidence.summary : null,
    consoleErrors: strings(evidence.consoleErrors),
    networkErrors: strings(evidence.networkErrors),
    screenshots: strings(evidence.screenshots).map(toScreenshotReference)
  };
}

function collectEvidence(bundle: RunBundle) {
  const discovery = parseJson<WebsiteDiscovery | null>(bundle.run.discoveryJson, null);
  const screenshots = new Set<string>();

  if (discovery?.screenshotPath) screenshots.add(discovery.screenshotPath);
  for (const event of bundle.events) {
    if (event.screenshotPath) screenshots.add(event.screenshotPath);
  }
  for (const result of bundle.results) {
    for (const screenshot of parseJson<string[]>(result.screenshotsJson, [])) screenshots.add(screenshot);
  }
  for (const bug of bundle.bugs) {
    for (const screenshot of parseEvidence(bug.evidenceJson).screenshots) screenshots.add(screenshot.publicPath);
  }

  return {
    screenshots: Array.from(screenshots).map(toScreenshotReference)
  };
}

function inferLikelyAffectedAreas(bug: Bug, evidence: ReturnType<typeof parseEvidence>) {
  const areas = new Set<string>();
  if (bug.category === "accessibility") areas.add("form labels, image alt text, keyboard focus, and ARIA state");
  if (bug.category === "security") areas.add("input validation, auth boundaries, and server-side request handling");
  if (bug.category === "performance") areas.add("slow routes, large client components, and network waterfalls");
  if (bug.category === "functional") areas.add("route handlers, client state, API calls, and CTA flows");
  if (bug.category === "ux") areas.add("primary flow components, validation copy, empty states, and navigation");
  if (evidence.networkErrors.length) areas.add("failing API routes or missing static assets from the network errors");
  if (evidence.consoleErrors.length) areas.add("client components referenced by the console stack or failing interaction");
  return areas.size ? Array.from(areas) : ["the route and component tree involved in the reproduction steps"];
}

function extractStepCandidates(value: unknown): string[] {
  if (typeof value === "string") {
    const reparsed = parseJson<unknown>(value, null);
    if (reparsed && reparsed !== value) return extractStepCandidates(reparsed);
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) return value.flatMap((item) => extractStepCandidates(item));

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const direct = record.label ?? record.step ?? record.action ?? record.text ?? record.description ?? record.instruction;
    const detail = record.detail ?? record.expected ?? record.result;
    if (typeof direct === "string" && direct.trim()) {
      return [typeof detail === "string" && detail.trim() ? `${direct}: ${detail}` : direct];
    }
    for (const key of ["steps", "reproductionSteps", "reproduction", "items"]) {
      if (key in record) return extractStepCandidates(record[key]);
    }
  }

  return [];
}

function toScreenshotReference(screenshot: string): ScreenshotReference {
  const publicPath = screenshot.startsWith("/") || /^https?:\/\//i.test(screenshot) ? screenshot : `/${screenshot}`;
  const baseUrl = (process.env.ARGUS_PUBLIC_URL ?? process.env.NEXT_PUBLIC_ARGUS_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const publicUrl = /^https?:\/\//i.test(publicPath) ? publicPath : `${baseUrl}${publicPath}`;
  const localPath = publicPath.startsWith("/runs/")
    ? argusPath("public", publicPath.replace(/^\/public\//, "").replace(/^\//, ""))
    : null;

  return { publicPath, publicUrl, localPath };
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}
