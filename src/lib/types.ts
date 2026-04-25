export type RunMode = "normal" | "chaos";
export type RunStatus = "queued" | "running" | "complete" | "failed";
export type ScenarioStatus = "passed" | "failed" | "warning";
export type BugSeverity = "low" | "medium" | "high" | "critical";
export type BugCategory =
  | "ux"
  | "functional"
  | "performance"
  | "accessibility"
  | "security"
  | "unknown";
export type BugStatus = "open" | "verified_fixed" | "still_failing";

export type Persona = {
  id: string;
  runId: string;
  name: string;
  goal: string;
  behavior: string;
  viewport: string;
  riskType: string;
};

export type Run = {
  id: string;
  url: string;
  mode: RunMode;
  status: RunStatus;
  createdAt: string;
  finishedAt: string | null;
};

export type ScenarioStep = {
  label: string;
  ok: boolean;
  detail?: string;
};

export type ScenarioResult = {
  id: string;
  runId: string;
  personaId: string;
  status: ScenarioStatus;
  summary: string;
  stepsJson: string;
  screenshotsJson: string;
  consoleErrorsJson: string;
  networkErrorsJson: string;
  startedAt: string;
  finishedAt: string | null;
};

export type Bug = {
  id: string;
  runId: string;
  personaId: string | null;
  title: string;
  severity: BugSeverity;
  category: BugCategory;
  reproductionStepsJson: string;
  evidenceJson: string;
  suggestedFix: string;
  patchSuggestion: string | null;
  status: BugStatus;
};

export type RunBundle = {
  run: Run;
  personas: Persona[];
  results: ScenarioResult[];
  bugs: Bug[];
};

export type GeneratedPersona = Omit<Persona, "id" | "runId">;

export type FailureAnalysisInput = {
  url: string;
  mode: RunMode;
  personas: Persona[];
  results: ScenarioResult[];
};

export type GeneratedBug = Omit<Bug, "id" | "runId" | "status"> & {
  personaId: string | null;
};
