import fs from "node:fs";
import path from "node:path";
import { parseJson } from "./json";
import type { Bug, Run } from "./types";

export function generatePatchSuggestion(run: Run, bugs: Bug[]) {
  const repoPath = process.env.ARGUS_REPO_PATH;
  const repoHint =
    repoPath && fs.existsSync(repoPath)
      ? `Configured repo path: ${repoPath}. Inspect files manually and apply this as a review guide.`
      : "No repo path configured, so Argus is producing bug-derived patch guidance instead of editing source.";

  const findings = bugs.length
    ? bugs.map((bug, index) => formatBugPatchSection(bug, index + 1)).join("\n\n")
    : "No open bug cards were available when this patch guidance was requested.";

  return `${repoHint}

Target URL: ${run.url}

Patch guidance:
${findings}`;
}

function formatBugPatchSection(bug: Bug, index: number) {
  const steps = normalizeSteps(bug.reproductionStepsJson).slice(0, 5);
  const evidence = parseJson<{ summary?: string; consoleErrors?: string[]; networkErrors?: string[]; screenshots?: string[] }>(bug.evidenceJson, {});

  return `### ${index}. [${bug.severity}] ${bug.title}
Category: ${bug.category}
Status: ${bug.status}

Suggested fix:
${bug.suggestedFix}

Reproduction:
${steps.length ? steps.map((step, stepIndex) => `${stepIndex + 1}. ${step}`).join("\n") : "No structured reproduction steps were captured for this finding."}

Evidence:
${[
  evidence.summary ? `- ${evidence.summary}` : null,
  evidence.consoleErrors?.length ? `- Console errors: ${evidence.consoleErrors.slice(0, 3).join(" | ")}` : null,
  evidence.networkErrors?.length ? `- Network errors: ${evidence.networkErrors.slice(0, 3).join(" | ")}` : null,
  evidence.screenshots?.length ? `- Screenshots: ${evidence.screenshots.slice(0, 3).join(", ")}` : null
]
  .filter(Boolean)
  .join("\n") || "- No evidence payload was attached."}`;
}

function normalizeSteps(value: string) {
  const parsed = parseJson<unknown>(value, value);
  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const label = record.label ?? record.step ?? record.action ?? record.text;
        const detail = record.detail ?? record.expected ?? record.result;
        if (typeof label === "string") return [typeof detail === "string" ? `${label}: ${detail}` : label];
      }
      return [];
    });
  }
  if (typeof parsed === "string") return parsed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return [];
}
