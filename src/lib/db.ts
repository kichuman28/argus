import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Bug, Persona, RecentRunSummary, Run, RunBundle, RunEvent, RunMode, RunStatus, ScenarioResult } from "./types";
import { nowIso } from "./ids";
import { argusPath } from "./paths";

const dbPath = argusPath("argus.sqlite");
let db: Database.Database | null = null;

function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      finishedAt TEXT,
      discoveryJson TEXT
    );
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      name TEXT NOT NULL,
      goal TEXT NOT NULL,
      behavior TEXT NOT NULL,
      viewport TEXT NOT NULL,
      riskType TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scenario_results (
      id TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      personaId TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      stepsJson TEXT NOT NULL,
      screenshotsJson TEXT NOT NULL,
      consoleErrorsJson TEXT NOT NULL,
      networkErrorsJson TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      finishedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS bugs (
      id TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      personaId TEXT,
      title TEXT NOT NULL,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      reproductionStepsJson TEXT NOT NULL,
      evidenceJson TEXT NOT NULL,
      suggestedFix TEXT NOT NULL,
      patchSuggestion TEXT,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS run_events (
      id TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      personaId TEXT,
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      screenshotPath TEXT,
      createdAt TEXT NOT NULL
    );
  `);
  const runColumns = db.pragma("table_info(runs)") as Array<{ name: string }>;
  if (!runColumns.some((column) => column.name === "discoveryJson")) {
    db.exec("ALTER TABLE runs ADD COLUMN discoveryJson TEXT");
  }
  return db;
}

export function createRun(run: Run) {
  getDb()
    .prepare("INSERT INTO runs (id, url, mode, status, createdAt, finishedAt, discoveryJson) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(run.id, run.url, run.mode, run.status, run.createdAt, run.finishedAt, run.discoveryJson);
}

export function updateRunStatus(id: string, status: RunStatus, finished = false) {
  getDb()
    .prepare("UPDATE runs SET status = ?, finishedAt = ? WHERE id = ?")
    .run(status, finished ? nowIso() : null, id);
}

export function getRun(id: string): Run | null {
  return (getDb().prepare("SELECT * FROM runs WHERE id = ?").get(id) as Run | undefined) ?? null;
}

export function getRecentRuns(limit = 10): RecentRunSummary[] {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  return getDb()
    .prepare(
      `SELECT
        runs.id,
        runs.url,
        runs.mode,
        runs.status,
        runs.createdAt,
        runs.finishedAt,
        COUNT(bugs.id) AS bugCount
       FROM runs
       LEFT JOIN bugs ON bugs.runId = runs.id
       GROUP BY runs.id
       ORDER BY runs.createdAt DESC
       LIMIT ?`
    )
    .all(safeLimit) as RecentRunSummary[];
}

export function updateRunDiscovery(id: string, discoveryJson: string) {
  getDb().prepare("UPDATE runs SET discoveryJson = ? WHERE id = ?").run(discoveryJson, id);
}

export function insertPersonas(personas: Persona[]) {
  const stmt = getDb().prepare(
    "INSERT INTO personas (id, runId, name, goal, behavior, viewport, riskType) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const tx = getDb().transaction((rows: Persona[]) => {
    for (const p of rows) stmt.run(p.id, p.runId, p.name, p.goal, p.behavior, p.viewport, p.riskType);
  });
  tx(personas);
}

export function getPersonas(runId: string): Persona[] {
  return getDb().prepare("SELECT * FROM personas WHERE runId = ?").all(runId) as Persona[];
}

export function insertScenarioResult(result: ScenarioResult) {
  getDb()
    .prepare(
      `INSERT INTO scenario_results
       (id, runId, personaId, status, summary, stepsJson, screenshotsJson, consoleErrorsJson, networkErrorsJson, startedAt, finishedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      result.id,
      result.runId,
      result.personaId,
      result.status,
      result.summary,
      result.stepsJson,
      result.screenshotsJson,
      result.consoleErrorsJson,
      result.networkErrorsJson,
      result.startedAt,
      result.finishedAt
    );
}

export function getScenarioResults(runId: string): ScenarioResult[] {
  return getDb().prepare("SELECT * FROM scenario_results WHERE runId = ? ORDER BY startedAt ASC").all(runId) as ScenarioResult[];
}

export function insertRunEvent(event: RunEvent) {
  getDb()
    .prepare("INSERT INTO run_events (id, runId, personaId, kind, message, screenshotPath, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(event.id, event.runId, event.personaId, event.kind, event.message, event.screenshotPath, event.createdAt);
}

export function getRunEvents(runId: string): RunEvent[] {
  return getDb().prepare("SELECT * FROM run_events WHERE runId = ? ORDER BY createdAt ASC").all(runId) as RunEvent[];
}

export function replaceBugs(runId: string, bugs: Bug[]) {
  const database = getDb();
  const tx = database.transaction((rows: Bug[]) => {
    database.prepare("DELETE FROM bugs WHERE runId = ?").run(runId);
    const stmt = database.prepare(
      `INSERT INTO bugs
       (id, runId, personaId, title, severity, category, reproductionStepsJson, evidenceJson, suggestedFix, patchSuggestion, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const bug of rows) {
      stmt.run(
        bug.id,
        bug.runId,
        bug.personaId,
        bug.title,
        bug.severity,
        bug.category,
        bug.reproductionStepsJson,
        bug.evidenceJson,
        bug.suggestedFix,
        bug.patchSuggestion,
        bug.status
      );
    }
  });
  tx(bugs);
}

export function getBugs(runId: string): Bug[] {
  return getDb().prepare("SELECT * FROM bugs WHERE runId = ? ORDER BY severity DESC").all(runId) as Bug[];
}

export function updateBugPatch(runId: string, patch: string) {
  getDb().prepare("UPDATE bugs SET patchSuggestion = COALESCE(patchSuggestion, ?) WHERE runId = ?").run(patch, runId);
}

export function updateBugStatuses(runId: string, status: "verified_fixed" | "still_failing") {
  getDb().prepare("UPDATE bugs SET status = ? WHERE runId = ? AND status = 'open'").run(status, runId);
}

export function getRunBundle(id: string): RunBundle | null {
  const run = getRun(id);
  if (!run) return null;
  return {
    run,
    personas: getPersonas(id),
    results: getScenarioResults(id),
    bugs: getBugs(id),
    events: getRunEvents(id)
  };
}

export function getLatestRunBundle(): RunBundle | null {
  const latest = getRecentRuns(1)[0];
  return latest ? getRunBundle(latest.id) : null;
}

export function normalizeMode(value: unknown): RunMode {
  return value === "chaos" ? "chaos" : "normal";
}
