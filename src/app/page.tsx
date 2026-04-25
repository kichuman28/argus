"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame, Loader2, Radar, ShieldAlert, Terminal } from "lucide-react";

type LaunchMode = "normal" | "chaos";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<LaunchMode>("normal");
  const [loading, setLoading] = useState<LaunchMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targetLabel = useMemo(() => formatTarget(url), [url]);

  async function launch() {
    if (!url.trim()) {
      setError("Enter a website URL.");
      return;
    }

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
    <main className="relative min-h-screen overflow-hidden bg-ink text-white">
      <div className="grid-sheen absolute inset-0 opacity-65" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
        <nav className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-acid/40 bg-acid/10 shadow-glow">
              <Radar className="h-5 w-5 text-acid" />
            </div>
            <div>
              <div className="text-lg font-semibold">Argus</div>
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-white/40">autonomous qa</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 border border-white/10 bg-white/[0.045] px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-white/58 sm:flex">
            <ShieldAlert className="h-4 w-4 text-cyan" />
            local-first browser agent
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] lg:py-14">
          <div className="max-w-4xl">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.32em] text-acid">AI users that test the app you just shipped</p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-none text-white sm:text-7xl lg:text-8xl">Argus</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/66">
              Drop in a local, preview, or hosted URL. Argus scouts the page, asks AI to understand it, deploys synthetic users, and returns evidence-backed bug reports.
            </p>

            <form
              className="mt-9 max-w-3xl border border-white/12 bg-black/35 p-3 shadow-2xl backdrop-blur"
              onSubmit={(event) => {
                event.preventDefault();
                void launch();
              }}
            >
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <label className="min-w-0">
                  <span className="sr-only">Website URL</span>
                  <input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    className="h-14 w-full border border-white/10 bg-white/[0.06] px-4 text-base text-white outline-none transition placeholder:text-white/32 focus:border-acid/70"
                    placeholder="http://localhost:3001 or https://your-preview-url"
                    inputMode="url"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading !== null}
                  className="inline-flex h-14 items-center justify-center gap-2 bg-acid px-5 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Launch
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <ModeButton active={mode === "normal"} disabled={loading !== null} label="Standard" onClick={() => setMode("normal")} />
                <ModeButton active={mode === "chaos"} disabled={loading !== null} label="Chaos" onClick={() => setMode("chaos")} />
              </div>

              {error ? <p className="mt-3 border border-pulse/30 bg-pulse/10 px-3 py-2 text-sm text-pink-100">{error}</p> : null}
              {loading ? <LaunchStatus mode={loading} target={targetLabel} /> : null}
            </form>
          </div>

          <LaunchConsole mode={mode} target={targetLabel} loading={loading} error={error} hasTarget={Boolean(url.trim())} />
        </div>
      </section>
    </main>
  );
}

function ModeButton({
  active,
  disabled,
  label,
  onClick
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 items-center justify-between border px-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? "border-acid/60 bg-acid/12 text-white" : "border-white/10 bg-white/[0.035] text-white/58 hover:border-white/18 hover:text-white"
      }`}
    >
      <span className="font-medium">{label}</span>
      {label === "Chaos" ? <Flame className={active ? "h-4 w-4 text-pulse" : "h-4 w-4 text-white/38"} /> : <Radar className={active ? "h-4 w-4 text-acid" : "h-4 w-4 text-white/38"} />}
    </button>
  );
}

function LaunchConsole({
  mode,
  target,
  loading,
  error,
  hasTarget
}: {
  mode: LaunchMode;
  target: string;
  loading: LaunchMode | null;
  error: string | null;
  hasTarget: boolean;
}) {
  const state = loading ? "creating-run" : error ? "blocked" : hasTarget ? "ready" : "idle";

  return (
    <aside className="shell-surface">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-white/48">
          <Terminal className="h-4 w-4 text-cyan" />
          launch console
        </div>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-pulse/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-acid/80" />
        </div>
      </div>
      <div className="space-y-4 p-5 font-mono text-sm">
        <p className="text-white/76">
          <span className="text-acid">$</span> argus launch
        </p>
        <ConsoleRow label="target" value={hasTarget ? target : "unset"} />
        <ConsoleRow label="mode" value={mode} />
        <ConsoleRow label="personas" value={mode === "chaos" ? "20" : "8"} />
        <ConsoleRow label="state" value={state} tone={error ? "danger" : loading ? "active" : "default"} />
        <div className="border-t border-white/10 pt-4 text-xs leading-6 text-white/42">
          {loading ? "The run is being created. Discovery, AI site brief generation, and persona planning happen before the dashboard opens." : "The dashboard will use real discovery data, run events, screenshots, personas, and bug cards from the target."}
        </div>
      </div>
    </aside>
  );
}

function ConsoleRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "active" | "danger" }) {
  const toneClass = tone === "danger" ? "text-pink-100" : tone === "active" ? "text-acid" : "text-white/72";

  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3">
      <span className="text-white/34">{label}</span>
      <span className={`min-w-0 break-words ${toneClass}`}>{value}</span>
    </div>
  );
}

function LaunchStatus({ mode, target }: { mode: LaunchMode; target: string }) {
  return (
    <div className="mt-4 border border-cyan/20 bg-cyan/8 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Loader2 className="h-4 w-4 animate-spin text-cyan" />
        Creating {mode} run
      </div>
      <div className="mt-3 space-y-1 font-mono text-xs leading-6 text-white/54">
        <p>
          <span className="text-acid">$</span> POST /api/runs
        </p>
        <p>target={target}</p>
        <p>status=waiting-for-dashboard-handoff</p>
      </div>
    </div>
  );
}

function formatTarget(raw: string) {
  const value = raw.trim();
  if (!value) return "unset";

  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);
    return parsed.toString();
  } catch {
    return value;
  }
}
