"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Flame, Loader2, Radar, ShieldAlert, Sparkles } from "lucide-react";

const launchStages = [
  "Validating target URL",
  "Opening Playwright scout browser",
  "Reading headings, links, buttons, and forms",
  "Generating website-aware synthetic users",
  "Starting autonomous QA runner"
];

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState<"normal" | "chaos" | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      setStageIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStageIndex((current) => Math.min(current + 1, launchStages.length - 1));
    }, 1300);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function launch(mode: "normal" | "chaos") {
    setError(null);
    setLoading(mode);
    try {
      const create = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, mode })
      });
      const payload = (await create.json()) as { runId?: string; error?: string };
      if (!create.ok || !payload.runId) throw new Error(payload.error ?? "Could not create run.");
      await fetch(`/api/runs/${payload.runId}/start`, { method: "POST" });
      router.push(`/runs/${payload.runId}`);
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : "Launch failed.");
      setLoading(null);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="grid-sheen absolute inset-0 opacity-80" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-acid/35 bg-acid/10 shadow-glow">
              <Radar className="h-5 w-5 text-acid" />
            </div>
            <span className="text-lg font-semibold tracking-wide">Argus</span>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/72 sm:flex">
            <ShieldAlert className="h-4 w-4 text-cyan" />
            Autonomous QA for hackathon velocity
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75">
              <Sparkles className="h-4 w-4 text-acid" />
              Most teams use AI to build faster. Argus uses AI to find what AI-built apps broke.
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal text-white sm:text-7xl">
              AI users that break your app, explain what failed, and prove the fix.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68">
              Drop in a URL. Argus deploys synthetic QA personas, drives the site with Playwright, captures evidence, and turns failures into bug cards your team can act on.
            </p>

            <div className="mt-9 max-w-3xl rounded-lg border border-white/12 bg-black/30 p-3 shadow-2xl">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className="min-h-14 flex-1 rounded-md border border-white/10 bg-white/8 px-4 text-base text-white outline-none transition placeholder:text-white/35 focus:border-acid/60"
                  placeholder="https://your-hackathon-app.dev"
                  inputMode="url"
                />
                <button
                  onClick={() => launch("normal")}
                  disabled={loading !== null}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-acid px-5 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Launch Argus
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => launch("chaos")}
                  disabled={loading !== null}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-pulse/55 bg-pulse/16 px-5 font-semibold text-white transition hover:bg-pulse/24 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Flame className="h-4 w-4 text-pulse" />
                  Chaos Mode
                </button>
              </div>
              {error ? <p className="mt-3 px-1 text-sm text-pulse">{error}</p> : null}
              {loading ? <LaunchProgress mode={loading} stageIndex={stageIndex} /> : null}
            </div>
          </div>

          <div className="glass rounded-lg p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-acid">Live demo shape</p>
                <h2 className="mt-2 text-2xl font-semibold">What Argus runs</h2>
              </div>
              <div className="rounded-md border border-white/10 bg-white/6 px-3 py-2 text-sm text-white/68">8 to 20 personas</div>
            </div>
            <div className="space-y-3">
              {[
                ["Synthetic users", "First-time, returning, mobile, keyboard, buyer, malicious, confused, accessibility-sensitive."],
                ["Playwright evidence", "Screenshots before, during, and after. Console errors and failed requests are captured."],
                ["Bug report", "Severity, category, reproduction steps, suggested fix, and PR-style patch text."],
                ["Verify fix", "Reruns failed personas and marks bugs fixed or still failing."]
              ].map(([title, text]) => (
                <div key={title} className="rounded-md border border-white/10 bg-white/[0.045] p-4">
                  <h3 className="font-semibold text-white">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-white/60">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function LaunchProgress({ mode, stageIndex }: { mode: "normal" | "chaos"; stageIndex: number }) {
  return (
    <div className="mt-4 rounded-md border border-white/10 bg-white/[0.045] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Loader2 className="h-4 w-4 animate-spin text-acid" />
          Launching {mode === "chaos" ? "Chaos Mode" : "Argus"}
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-white/42">setup</span>
      </div>
      <div className="space-y-2">
        {launchStages.map((stage, index) => {
          const done = index < stageIndex;
          const active = index === stageIndex;
          return (
            <div key={stage} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  done ? "border-acid bg-acid text-black" : active ? "border-cyan text-cyan" : "border-white/12 text-white/25"
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : active ? <span className="h-1.5 w-1.5 rounded-full bg-cyan" /> : null}
              </span>
              <span className={done || active ? "text-white/78" : "text-white/35"}>{stage}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
