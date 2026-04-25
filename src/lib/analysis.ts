import { createId } from "./ids";
import { parseJson, stringifyJson } from "./json";
import { analyzeFailuresWithAi } from "./openai";
import type { Bug, FailureAnalysisInput, GeneratedBug, ScenarioStep } from "./types";

export async function createBugCards(input: FailureAnalysisInput): Promise<Bug[]> {
  const aiBugs = await analyzeFailuresWithAi(input);
  const generated = aiBugs?.length ? aiBugs : heuristicBugs(input);
  return generated.map((bug) => ({
    id: createId("bug"),
    runId: input.results[0]?.runId ?? "",
    personaId: bug.personaId,
    title: bug.title,
    severity: bug.severity,
    category: bug.category,
    reproductionStepsJson: bug.reproductionStepsJson,
    evidenceJson: bug.evidenceJson,
    suggestedFix: bug.suggestedFix,
    patchSuggestion: bug.patchSuggestion,
    status: "open"
  }));
}

function heuristicBugs(input: FailureAnalysisInput): GeneratedBug[] {
  const bugs: GeneratedBug[] = [];
  for (const result of input.results) {
    const steps = parseJson<ScenarioStep[]>(result.stepsJson, []);
    const screenshots = parseJson<string[]>(result.screenshotsJson, []);
    const consoleErrors = parseJson<string[]>(result.consoleErrorsJson, []);
    const networkErrors = parseJson<string[]>(result.networkErrorsJson, []);
    const persona = input.personas.find((item) => item.id === result.personaId);

    if (networkErrors.length) {
      bugs.push({
        personaId: result.personaId,
        title: `${persona?.name ?? "Persona"} hit failed network requests`,
        severity: "high",
        category: "functional",
        reproductionStepsJson: stringifyJson(steps),
        evidenceJson: stringifyJson({ networkErrors, screenshots }),
        suggestedFix: "Inspect failing requests, confirm route/API availability, and add user-facing retry or error states for failed resources.",
        patchSuggestion: null
      });
    }

    if (consoleErrors.length) {
      bugs.push({
        personaId: result.personaId,
        title: `${persona?.name ?? "Persona"} triggered browser console errors`,
        severity: "medium",
        category: "functional",
        reproductionStepsJson: stringifyJson(steps),
        evidenceJson: stringifyJson({ consoleErrors, screenshots }),
        suggestedFix: "Reproduce the console stack locally, guard undefined state, and add a regression test around the failing interaction.",
        patchSuggestion: null
      });
    }

    const failedStep = steps.find((step) => !step.ok);
    if (failedStep || result.status === "failed") {
      bugs.push({
        personaId: result.personaId,
        title: failedStep?.label ?? `${persona?.name ?? "Persona"} could not complete the expected flow`,
        severity: persona?.riskType === "security" ? "critical" : "medium",
        category: persona?.riskType === "accessibility" ? "accessibility" : persona?.riskType === "security" ? "security" : "ux",
        reproductionStepsJson: stringifyJson(steps),
        evidenceJson: stringifyJson({ summary: result.summary, screenshots }),
        suggestedFix: "Clarify the visible path for this user goal, improve validation feedback, and ensure the primary CTA remains reachable after each state change.",
        patchSuggestion: null
      });
    }
  }

  if (!bugs.length && input.results.length) {
    const first = input.results[0];
    bugs.push({
      personaId: first.personaId,
      title: "No blocking failure found; add stronger empty, loading, and validation states",
      severity: "low",
      category: "ux",
      reproductionStepsJson: first.stepsJson,
      evidenceJson: stringifyJson({ screenshots: parseJson<string[]>(first.screenshotsJson, []) }),
      suggestedFix: `The happy path survived. For a stronger demo, verify edge states around ${input.discovery?.keywords.join(", ") || "blank forms, failed requests, slow loading, keyboard focus, and post-submit success copy"}.`,
      patchSuggestion: null
    });
  }

  return bugs.slice(0, 12);
}
