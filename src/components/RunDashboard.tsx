"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, CircleDashed, Code2, FlaskConical, Loader2, Radar, RefreshCw, TriangleAlert, Users } from "lucide-react";
import type { Bug, Persona, Run, ScenarioResult } from "@/lib/types";
import { parseJson } from "@/lib/json";

type Bundle = {
  run: Run;
  personas: Persona[];
  results: ScenarioResult[];
  bugs: Bug[];
  active?: boolean;
};

const severityClass: Record<string, string> = {
  critical: "border-red-400/40 bg-red-500/15 text-red-100",
  high: "border-pulse/45 bg-pulse/14 text-pink-100",
  medium: "border-amber-300/40 bg-amber-400/12 text-amber-100",
  low: "border-cyan/35 bg-cyan/12 text-cyan"
};

export default function RunDashboard() {
  const params = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patch, setPatch] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"verify" | "patch" | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/runs/${params.id}`, { cache: "no-store" });
    const payload = (await response.json()) as Bundle | { error?: string };
    if (!response.ok) {
      setError("error" in payload ? payload.error ?? "Run not found." : "Run not found.");
      return;
    }
    setBundle(payload as Bundle);
  }, [params.id]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 1500);
    return () => window.clearInterval(timer);
  }, [load]);

  const stats = useMemo(() => {
    const results = bundle?.results ?? [];
    return {
      passed: results.filter((result) => result.status === "passed").length,
      failed: results.filter((result) => result.status === "failed").length,
      warning: results.filter((result) => result.status === "warning").length
    };
  }, [bundle?.results]);

  async function verify() {
    setBusyAction("verify");
    await fetch(`/api/runs/${params.id}/verify`, { method: "POST" });
    setTimeout(() => {
      setBusyAction(null);
      void load();
    }, 900);
  }

  async function generatePatch() {
    setBusyAction("patch");
    const response = await fetch(`/api/runs/${params.id}/patch`, { method: "POST" });
    const payload = (await response.json()) as { patch?: string };
    setPatch(payload.patch ?? "No patch suggestion was generated.");
    setBusyAction(null);
    void load();
  }

  if (error) {
    return <main className="min-h-screen bg-ink p-8 text-white">{error}</main>;
  }

  if (!bundle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink text-white">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-acid" />
        Loading Argus run...
      </main>
    );
  }

  const progress = bundle.personas.length ? Math.min(100, Math.round((bundle.results.length / bundle.personas.length) * 100)) : 0;
  const running = bundle.run.status === "running" || bundle.active;

  return (
    <main className="min-h-screen bg-ink text-white">
      <div className="grid-sheen fixed inset-0 opacity-50" />
      <div className="relative mx-auto w-full max-w-7xl px-6 py-7">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-acid/35 bg-acid/10">
                <Radar className="h-5 w-5 text-acid" />
              </div>
              <span className="text-xl font-semibold">Argus</span>
              <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/62">
                {bundle.run.mode}
              </span>
            </div>
            <h1 className="max-w-4xl text-3xl font-semibold leading-tight text-white md:text-5xl">{bundle.run.url}</h1>
            <p className="mt-3 text-white/60">AI users deployed, Playwright evidence captured, report assembled live-ish.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={verify}
              disabled={running || busyAction !== null}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-white/14 bg-white/7 px-4 font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busyAction === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-cyan" />}
              Verify fix
            </button>
            <button
              onClick={generatePatch}
              disabled={busyAction !== null}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-acid px-4 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busyAction === "patch" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
              Generate patch
            </button>
          </div>
        </header>

        <section className="grid gap-4 py-6 md:grid-cols-4">
          <Metric icon={<Users className="h-5 w-5 text-acid" />} label="synthetic users deployed" value={bundle.personas.length} />
          <Metric icon={<CheckCircle2 className="h-5 w-5 text-acid" />} label="passed flows" value={stats.passed} />
          <Metric icon={<TriangleAlert className="h-5 w-5 text-pulse" />} label="failed or warning" value={stats.failed + stats.warning} />
          <Metric icon={running ? <Loader2 className="h-5 w-5 animate-spin text-cyan" /> : <CircleDashed className="h-5 w-5 text-cyan" />} label="run status" value={bundle.run.status} />
        </section>

        <section className="glass rounded-lg p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Progress timeline</h2>
            <span className="text-sm text-white/55">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-acid transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {bundle.results.slice(-8).map((result) => {
              const persona = bundle.personas.find((item) => item.id === result.personaId);
              return (
                <div key={result.id} className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                  <p className="truncate text-sm font-medium">{persona?.name ?? "Persona"}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">{result.status}</p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 py-6 lg:grid-cols-[0.88fr_1.12fr]">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Personas tested</h2>
            {bundle.personas.map((persona) => (
              <div key={persona.id} className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{persona.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-white/58">{persona.goal}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/55">{persona.riskType}</span>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Bug cards</h2>
            {bundle.bugs.length ? (
              bundle.bugs.map((bug) => <BugCard key={bug.id} bug={bug} personas={bundle.personas} />)
            ) : (
              <div className="glass rounded-lg p-8 text-center text-white/60">
                <FlaskConical className="mx-auto mb-3 h-8 w-8 text-acid" />
                {running ? "The browser runner is collecting evidence now." : "No bug cards yet. Start or rerun Argus."}
              </div>
            )}
          </section>
        </div>

        {patch ? (
          <section className="mb-8 rounded-lg border border-acid/25 bg-black/45 p-5">
            <h2 className="mb-3 text-xl font-semibold">Patch suggestion</h2>
            <pre className="max-h-[28rem] overflow-auto rounded-md border border-white/10 bg-black/70 p-4 text-sm leading-6 text-white/78">
              {patch}
            </pre>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="glass rounded-lg p-4">
      <div className="mb-4">{icon}</div>
      <div className="text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-white/50">{label}</div>
    </div>
  );
}

function BugCard({ bug, personas }: { bug: Bug; personas: Persona[] }) {
  const persona = personas.find((item) => item.id === bug.personaId);
  const steps = parseJson<Array<{ label: string; ok: boolean; detail?: string }>>(bug.reproductionStepsJson, []);
  const evidence = parseJson<{ screenshots?: string[]; consoleErrors?: string[]; networkErrors?: string[]; summary?: string }>(bug.evidenceJson, {});
  const screenshots = evidence.screenshots ?? [];

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{bug.title}</h3>
          <p className="mt-1 text-sm text-white/50">{persona?.name ?? "General finding"} · {bug.category} · {bug.status}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${severityClass[bug.severity] ?? severityClass.low}`}>
          {bug.severity}
        </span>
      </div>

      {screenshots.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {screenshots.slice(0, 2).map((src) => (
            <Image
              key={src}
              src={src}
              alt="Argus evidence screenshot"
              width={720}
              height={405}
              className="aspect-video w-full rounded-md border border-white/10 object-cover"
              unoptimized
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4 rounded-md border border-white/10 bg-black/24 p-4">
        <p className="mb-2 text-sm font-semibold text-white/80">Reproduction steps</p>
        <ol className="space-y-2 text-sm leading-6 text-white/62">
          {steps.slice(0, 5).map((step, index) => (
            <li key={`${step.label}-${index}`}>{index + 1}. {step.label}{step.detail ? `: ${step.detail}` : ""}</li>
          ))}
        </ol>
      </div>

      <p className="mt-4 text-sm leading-6 text-white/68">{bug.suggestedFix}</p>
      {bug.patchSuggestion ? (
        <pre className="mt-4 max-h-72 overflow-auto rounded-md border border-white/10 bg-black/60 p-3 text-xs leading-5 text-white/70">{bug.patchSuggestion}</pre>
      ) : null}
    </article>
  );
}
