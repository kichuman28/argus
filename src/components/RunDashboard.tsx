"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  Brain,
  Check,
  CheckCircle2,
  CircleDashed,
  Copy,
  Eye,
  Expand,
  FlaskConical,
  Loader2,
  Plug,
  Radar,
  RefreshCw,
  Terminal,
  TriangleAlert,
  Users,
  X
} from "lucide-react";
import type { Bug, Persona, Run, RunEvent, ScenarioResult, WebsiteDiscovery } from "@/lib/types";
import { parseJson } from "@/lib/json";

type Bundle = {
  run: Run;
  personas: Persona[];
  results: ScenarioResult[];
  bugs: Bug[];
  events: RunEvent[];
  active?: boolean;
};

type McpConfig = {
  argusRoot: string;
  publicUrl: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  vscodeMcpJson: string;
  codexPrompt: string;
};

const severityClass: Record<string, string> = {
  critical: "border-red-400/40 bg-red-500/15 text-red-100",
  high: "border-pulse/45 bg-pulse/14 text-pink-100",
  medium: "border-amber-300/40 bg-amber-400/12 text-amber-100",
  low: "border-cyan/35 bg-cyan/12 text-cyan"
};

type DashboardSection = "overview" | "understanding" | "bugs" | "personas" | "logs" | "evidence" | "mcp";

export default function RunDashboard() {
  const params = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mcpConfig, setMcpConfig] = useState<McpConfig | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");
  const [busyAction, setBusyAction] = useState<"verify" | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    async function loadMcpConfig() {
      const response = await fetch(`/api/mcp/config?runId=${encodeURIComponent(params.id)}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as McpConfig;
      if (!cancelled) setMcpConfig(payload);
    }
    void loadMcpConfig();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const stats = useMemo(() => {
    const results = bundle?.results ?? [];
    return {
      passed: results.filter((result) => result.status === "passed").length,
      failed: results.filter((result) => result.status === "failed").length,
      warning: results.filter((result) => result.status === "warning").length
    };
  }, [bundle?.results]);

  const verification = useMemo(() => {
    const bugs = bundle?.bugs ?? [];
    return {
      open: bugs.filter((bug) => bug.status === "open").length,
      verified: bugs.filter((bug) => bug.status === "verified_fixed").length,
      stillFailing: bugs.filter((bug) => bug.status === "still_failing").length
    };
  }, [bundle?.bugs]);

  async function verify() {
    setBusyAction("verify");
    setActiveSection("logs");
    await fetch(`/api/runs/${params.id}/verify`, { method: "POST" });
    setTimeout(() => {
      setBusyAction(null);
      void load();
    }, 900);
  }

  async function copyText(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
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
  const running = bundle.run.status === "running" || Boolean(bundle.active);
  const discovery = parseJson<WebsiteDiscovery | null>(bundle.run.discoveryJson, null);
  const latestScreenshot = [...bundle.events].reverse().find((event) => event.screenshotPath)?.screenshotPath ?? discovery?.screenshotPath ?? null;
  const allScreenshots = Array.from(
    new Set([
      ...(discovery?.screenshotPath ? [discovery.screenshotPath] : []),
      ...bundle.events.map((event) => event.screenshotPath).filter((src): src is string => Boolean(src)),
      ...bundle.results.flatMap((result) => parseJson<string[]>(result.screenshotsJson, []))
    ])
  );
  const sidebarItems: Array<{ id: DashboardSection; label: string; icon: ReactNode; count?: number }> = [
    { id: "overview", label: "Overview", icon: <Radar className="h-4 w-4" /> },
    { id: "understanding", label: "Understanding", icon: <Brain className="h-4 w-4" /> },
    { id: "bugs", label: "Bugs", icon: <TriangleAlert className="h-4 w-4" />, count: bundle.bugs.length },
    { id: "personas", label: "Personas", icon: <Users className="h-4 w-4" />, count: bundle.personas.length },
    { id: "logs", label: "Live logs", icon: <Activity className="h-4 w-4" />, count: bundle.events.length },
    { id: "evidence", label: "Evidence", icon: <Eye className="h-4 w-4" />, count: allScreenshots.length },
    { id: "mcp", label: "MCP setup", icon: <Plug className="h-4 w-4" /> }
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-ink text-white">
      <div className="grid-sheen fixed inset-0 opacity-50" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-black/20 px-4 py-5 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-5">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-acid/35 bg-acid/10">
              <Radar className="h-5 w-5 text-acid" />
            </div>
            <div>
              <div className="font-semibold">Argus</div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/38">{bundle.run.mode} run</div>
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-white/10 bg-white/[0.045] p-3">
            <p className="line-clamp-2 break-all text-sm font-medium text-white/86">{bundle.run.url}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-acid transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/42">
              <span>{progress}% complete</span>
              <span>{bundle.run.status}</span>
            </div>
          </div>

          <nav className="grid gap-2 sm:grid-cols-4 lg:grid-cols-1">
            {sidebarItems.map((item) => (
              <SidebarButton
                key={item.id}
                active={activeSection === item.id}
                icon={item.icon}
                label={item.label}
                count={item.count}
                onClick={() => setActiveSection(item.id)}
              />
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.24em] text-acid">Autonomous QA run</p>
              <h1 className="mt-2 truncate text-3xl font-semibold leading-tight text-white md:text-5xl">{sectionTitle(activeSection)}</h1>
              <p className="mt-3 max-w-3xl text-white/58">{sectionDescription(activeSection)}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setActiveSection("mcp")}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-white/14 bg-white/7 px-4 font-medium text-white transition hover:bg-white/10"
              >
                <Plug className="h-4 w-4 text-acid" />
                MCP setup
              </button>
              <button
                onClick={verify}
                disabled={running || busyAction !== null}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-white/14 bg-white/7 px-4 font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {busyAction === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-cyan" />}
                Verify fixes
              </button>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric icon={<Users className="h-5 w-5 text-acid" />} label="synthetic users deployed" value={bundle.personas.length} />
            <Metric icon={<CheckCircle2 className="h-5 w-5 text-acid" />} label="passed flows" value={stats.passed} />
            <Metric icon={<TriangleAlert className="h-5 w-5 text-pulse" />} label="failed or warning" value={stats.failed + stats.warning} />
            <Metric icon={running ? <Loader2 className="h-5 w-5 animate-spin text-cyan" /> : <CircleDashed className="h-5 w-5 text-cyan" />} label="run status" value={bundle.run.status} />
          </section>

          <div className="mt-6">
            {activeSection === "overview" ? (
              <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
                <div className="space-y-6">
                  <RunLogs events={bundle.events} personas={bundle.personas} onOpenScreenshot={setLightbox} running={running} compact />
                  <UnderstandingCard discovery={discovery} compact onOpen={() => setActiveSection("understanding")} />
                </div>
                <EvidencePreview latestScreenshot={latestScreenshot} discovery={discovery} onOpenScreenshot={setLightbox} onOpenGallery={() => setActiveSection("evidence")} />
              </section>
            ) : null}

            {activeSection === "understanding" ? <UnderstandingCard discovery={discovery} /> : null}

            {activeSection === "bugs" ? (
              <section className="space-y-4">
                {bundle.bugs.length ? (
                  bundle.bugs.map((bug) => <BugCard key={bug.id} bug={bug} personas={bundle.personas} onOpenScreenshot={setLightbox} />)
                ) : (
                  <EmptyState icon={<FlaskConical className="h-8 w-8 text-acid" />} text={running ? "The browser runner is collecting evidence now." : "No bug cards yet. Start or rerun Argus."} />
                )}
              </section>
            ) : null}

            {activeSection === "personas" ? (
              <section className="grid gap-4 xl:grid-cols-2">
                {bundle.personas.map((persona) => (
                  <PersonaCard key={persona.id} persona={persona} result={bundle.results.find((result) => result.personaId === persona.id)} />
                ))}
              </section>
            ) : null}

            {activeSection === "logs" ? <RunLogs events={bundle.events} personas={bundle.personas} onOpenScreenshot={setLightbox} running={running} /> : null}

            {activeSection === "evidence" ? <EvidenceGallery screenshots={allScreenshots} onOpenScreenshot={setLightbox} /> : null}

            {activeSection === "mcp" ? (
              <McpHandoffPanel
                config={mcpConfig}
                copiedKey={copiedKey}
                runId={bundle.run.id}
                targetUrl={bundle.run.url}
                verification={verification}
                verifying={busyAction === "verify"}
                running={running}
                onCopy={copyText}
                onVerify={verify}
              />
            ) : null}
          </div>
        </div>
      </div>
      {lightbox ? <ScreenshotLightbox src={lightbox} onClose={() => setLightbox(null)} /> : null}
    </main>
  );
}

function sectionTitle(section: DashboardSection) {
  const titles: Record<DashboardSection, string> = {
    overview: "Run overview",
    understanding: "What Argus understood",
    bugs: "Bug cards",
    personas: "Synthetic users",
    logs: "Live runner logs",
    evidence: "Evidence gallery",
    mcp: "MCP handoff"
  };
  return titles[section];
}

function sectionDescription(section: DashboardSection) {
  const descriptions: Record<DashboardSection, string> = {
    overview: "A focused command center for status, latest activity, and current evidence.",
    understanding: "The discovery scan Argus used to tailor personas and scenario choices.",
    bugs: "Evidence-backed findings with severity, reproduction, and suggested fixes.",
    personas: "The website-aware synthetic users deployed against this run.",
    logs: "A UI-visible stream of what the Playwright runner is doing right now.",
    evidence: "All screenshots captured during discovery and persona execution.",
    mcp: "Connect Codex from the target repo, pull the repair brief, then rerun failed personas here."
  };
  return descriptions[section];
}

function SidebarButton({
  active,
  icon,
  label,
  count,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-11 items-center justify-between gap-3 rounded-md px-3 text-sm font-medium transition ${
        active ? "bg-acid text-black" : "border border-white/8 bg-white/[0.035] text-white/68 hover:bg-white/9 hover:text-white"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {typeof count === "number" ? (
        <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-black/12 text-black" : "bg-black/24 text-white/45"}`}>{count}</span>
      ) : null}
    </button>
  );
}

function EvidencePreview({
  latestScreenshot,
  discovery,
  onOpenScreenshot,
  onOpenGallery
}: {
  latestScreenshot: string | null;
  discovery: WebsiteDiscovery | null;
  onOpenScreenshot: (src: string) => void;
  onOpenGallery: () => void;
}) {
  return (
    <div className="glass rounded-lg p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Latest evidence</h2>
          <p className="mt-1 text-sm text-white/50">{discovery?.title ? `Scouted: ${discovery.title}` : "Latest screenshot appears here."}</p>
        </div>
        <button onClick={onOpenGallery} className="rounded-md border border-white/12 bg-white/7 px-3 py-2 text-sm text-white/70 hover:bg-white/10">
          Gallery
        </button>
      </div>
      {latestScreenshot ? (
        <button onClick={() => onOpenScreenshot(latestScreenshot)} className="group relative block w-full overflow-hidden rounded-md border border-white/10 bg-black/40 text-left">
          <Image src={latestScreenshot} alt="Latest Argus evidence" width={1100} height={680} className="max-h-[34rem] w-full object-contain" unoptimized />
          <span className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-md bg-black/70 px-3 py-2 text-sm opacity-0 transition group-hover:opacity-100">
            <Expand className="h-4 w-4 text-acid" />
            Enlarge
          </span>
        </button>
      ) : (
        <div className="flex min-h-72 items-center justify-center rounded-md border border-dashed border-white/14 text-white/45">No screenshot captured yet.</div>
      )}
    </div>
  );
}

function UnderstandingCard({ discovery, compact = false, onOpen }: { discovery: WebsiteDiscovery | null; compact?: boolean; onOpen?: () => void }) {
  const routes = discovery?.routes ?? [];
  const forms = discovery?.forms ?? [];
  const buttons = discovery?.buttons ?? [];
  const hints = discovery?.accessibilityHints ?? [];
  const aiDescription = discovery?.aiDescription?.trim();

  return (
    <div className="glass rounded-lg p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">What Argus understood</h2>
          <p className="mt-1 text-sm text-white/50">{discovery?.title || "Discovery summary is still being prepared."}</p>
        </div>
        {compact && onOpen ? (
          <button onClick={onOpen} className="rounded-md border border-white/12 bg-white/7 px-3 py-2 text-sm text-white/70 hover:bg-white/10">
            Open
          </button>
        ) : null}
      </div>
      <div className="mb-5 border border-acid/20 bg-acid/[0.055] p-4">
        <div className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-acid">AI site brief</div>
        {aiDescription ? (
          <p className="text-sm leading-6 text-white/74">{aiDescription}</p>
        ) : (
          <p className="text-sm leading-6 text-white/42">
            {discovery ? "OpenAI did not return a site description for this run." : "Waiting for discovery and AI site description."}
          </p>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MiniStat label="routes" value={routes.length} />
        <MiniStat label="forms" value={forms.length} />
        <MiniStat label="actions" value={buttons.length} />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <SignalList title="Routes discovered" items={routes} empty="No routes found." limit={compact ? 5 : 16} />
        <SignalList title="Buttons/actions" items={buttons} empty="No visible actions found." limit={compact ? 5 : 16} />
        {!compact ? (
          <>
            <SignalList
              title="Forms and inputs"
              items={forms.map((form) => [form.label, form.placeholder, form.name, form.type].filter(Boolean).join(" / "))}
              empty="No inputs found."
              limit={18}
            />
            <SignalList title="Accessibility hints" items={hints} empty="No obvious accessibility hints in discovery." limit={12} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-[0.16em] text-white/38">{label}</div>
    </div>
  );
}

function SignalList({ title, items, empty, limit }: { title: string; items: string[]; empty: string; limit: number }) {
  const visible = items.filter(Boolean).slice(0, limit);
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-4">
      <h3 className="mb-3 text-sm font-semibold text-white/82">{title}</h3>
      {visible.length ? (
        <div className="flex flex-wrap gap-2">
          {visible.map((item, index) => (
            <span key={`${item}-${index}`} className="max-w-full truncate rounded-full border border-white/10 bg-black/24 px-3 py-1 text-xs text-white/58">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/42">{empty}</p>
      )}
    </div>
  );
}

function EvidenceGallery({ screenshots, onOpenScreenshot }: { screenshots: string[]; onOpenScreenshot: (src: string) => void }) {
  if (!screenshots.length) {
    return <EmptyState icon={<Eye className="h-8 w-8 text-acid" />} text="No screenshots have been captured yet." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {screenshots.map((src) => (
        <button key={src} onClick={() => onOpenScreenshot(src)} className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/40 text-left">
          <Image src={src} alt="Argus evidence screenshot" width={720} height={440} className="aspect-video w-full object-cover transition group-hover:scale-[1.02]" unoptimized />
          <span className="absolute right-3 top-3 rounded-md bg-black/70 p-2 opacity-0 transition group-hover:opacity-100">
            <Expand className="h-4 w-4 text-acid" />
          </span>
        </button>
      ))}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="glass rounded-lg p-8 text-center text-white/58">
      <div className="mx-auto mb-3 flex justify-center">{icon}</div>
      <p>{text}</p>
    </div>
  );
}

function McpHandoffPanel({
  config,
  copiedKey,
  runId,
  targetUrl,
  verification,
  verifying,
  running,
  onCopy,
  onVerify
}: {
  config: McpConfig | null;
  copiedKey: string | null;
  runId: string;
  targetUrl: string;
  verification: { open: number; verified: number; stillFailing: number };
  verifying: boolean;
  running: boolean;
  onCopy: (key: string, value: string) => Promise<void>;
  onVerify: () => Promise<void>;
}) {
  if (!config) {
    return <EmptyState icon={<Plug className="h-8 w-8 text-acid" />} text="Preparing the MCP connection details for this run." />;
  }

  const commandLine = formatCommand(config.command, config.args);

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.72fr)]">
      <div className="terminal-panel">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-white/50">
            <Terminal className="h-4 w-4 text-cyan" />
            target repo handoff
          </div>
          <span className="font-mono text-xs text-white/36">stdio</span>
        </div>
        <div className="space-y-5 p-4">
          <CopyableBlock
            title=".vscode/mcp.json"
            value={config.vscodeMcpJson}
            copyKey="mcp-json"
            copiedKey={copiedKey}
            onCopy={onCopy}
          />
          <CopyableBlock
            title="Codex prompt"
            value={config.codexPrompt}
            copyKey="codex-prompt"
            copiedKey={copiedKey}
            onCopy={onCopy}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="glass rounded-lg p-5">
          <h2 className="text-lg font-semibold">Connection values</h2>
          <div className="mt-4 space-y-3 font-mono text-xs">
            <McpValue label="name" value="argus" />
            <McpValue label="transport" value="stdio" />
            <McpValue label="command" value={config.command} />
            <McpValue label="arguments" value={config.args.join(" ")} />
            <McpValue label="ARGUS_HOME" value={config.argusRoot} />
            <McpValue label="ARGUS_PUBLIC_URL" value={config.publicUrl} />
          </div>
          <button
            onClick={() => void onCopy("mcp-command", commandLine)}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-white/12 bg-white/7 px-3 text-sm text-white/72 transition hover:bg-white/10"
          >
            {copiedKey === "mcp-command" ? <Check className="h-4 w-4 text-acid" /> : <Copy className="h-4 w-4 text-cyan" />}
            Copy launch command
          </button>
        </div>

        <div className="glass rounded-lg p-5">
          <h2 className="text-lg font-semibold">Fix verification</h2>
          <p className="mt-2 break-all text-sm leading-6 text-white/56">{targetUrl}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="open" value={verification.open} />
            <MiniStat label="fixed" value={verification.verified} />
            <MiniStat label="failing" value={verification.stillFailing} />
          </div>
          <div className="mt-4 rounded-md border border-white/10 bg-black/24 p-3 font-mono text-xs leading-6 text-white/58">
            <p>run={runId}</p>
            <p>repair=codex-mcp</p>
            <p>verify={running ? "running" : "ready"}</p>
          </div>
          <button
            onClick={() => void onVerify()}
            disabled={running || verifying}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-acid px-4 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Verify fixes
          </button>
        </div>
      </div>
    </section>
  );
}

function CopyableBlock({
  title,
  value,
  copyKey,
  copiedKey,
  onCopy
}: {
  title: string;
  value: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => Promise<void>;
}) {
  const copied = copiedKey === copyKey;
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-white/50">{title}</div>
        <button
          onClick={() => void onCopy(copyKey, value)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/12 bg-white/7 px-3 text-sm text-white/70 transition hover:bg-white/10"
        >
          {copied ? <Check className="h-4 w-4 text-acid" /> : <Copy className="h-4 w-4 text-cyan" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-4 text-xs leading-6 text-white/74">{value}</pre>
    </div>
  );
}

function McpValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-white/8 pb-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
      <span className="text-white/34">{label}</span>
      <span className="min-w-0 break-words text-white/72">{value}</span>
    </div>
  );
}

function formatCommand(command: string, args: string[]) {
  return [command, ...args].map((part) => (/\s/.test(part) ? `"${part}"` : part)).join(" ");
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

function PersonaCard({ persona, result }: { persona: Persona; result?: ScenarioResult }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{persona.name}</h3>
          <p className="mt-1 text-sm leading-6 text-white/62">{persona.goal}</p>
          <p className="mt-3 text-xs leading-5 text-white/45">{persona.behavior}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/55">{persona.riskType}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/38">
        <span>{persona.viewport}</span>
        <span>/</span>
        <span>{result?.status ?? "pending"}</span>
      </div>
    </div>
  );
}

function RunLogs({
  events,
  personas,
  onOpenScreenshot,
  running,
  compact = false
}: {
  events: RunEvent[];
  personas: Persona[];
  onOpenScreenshot: (src: string) => void;
  running: boolean;
  compact?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleEvents = compact ? events.slice(-10) : events;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight });
  }, [events.length]);

  return (
    <div className="terminal-panel">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-white/50">
          <Terminal className="h-4 w-4 text-cyan" />
          {compact ? "runner stream" : "live runner terminal"}
        </div>
        <span className="font-mono text-xs text-white/36">{events.length} events</span>
      </div>
      <div ref={scrollRef} className={`${compact ? "max-h-80" : "max-h-[42rem]"} overflow-auto p-4 font-mono text-xs`}>
        {visibleEvents.length ? (
          <div className="space-y-2">
            {visibleEvents.map((event) => {
              const persona = personas.find((item) => item.id === event.personaId);
              return (
                <div key={event.id} className="grid gap-2 border-l border-white/10 pl-3 sm:grid-cols-[5.25rem_6.75rem_minmax(0,1fr)_auto] sm:items-start">
                  <span className="text-white/34">{formatEventTime(event.createdAt)}</span>
                  <span className={`uppercase ${eventKindClass(event.kind)}`}>{event.kind}</span>
                  <span className="min-w-0 leading-5 text-white/72">
                    {persona ? <span className="text-white/42">{persona.name}: </span> : null}
                    {event.message}
                  </span>
                  {event.screenshotPath ? (
                    <button
                      onClick={() => onOpenScreenshot(event.screenshotPath!)}
                      className="justify-self-start border border-cyan/20 bg-cyan/[0.08] px-2 py-1 text-cyan transition hover:border-cyan/40 hover:bg-cyan/[0.12]"
                    >
                      evidence
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border-l border-white/10 pl-3 leading-6 text-white/42">Waiting for the first persisted runner event.</div>
        )}
        {running ? (
          <div className="mt-3 border-l border-acid/35 pl-3 leading-6 text-acid">
            stream=open <span className="cursor-blink">_</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function eventKindClass(kind: RunEvent["kind"]) {
  const classes: Record<RunEvent["kind"], string> = {
    discovery: "text-acid",
    persona: "text-cyan",
    action: "text-white/66",
    screenshot: "text-cyan",
    finding: "text-pink-100",
    complete: "text-acid",
    error: "text-pulse"
  };
  return classes[kind];
}

function formatEventTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function BugCard({ bug, personas, onOpenScreenshot }: { bug: Bug; personas: Persona[]; onOpenScreenshot: (src: string) => void }) {
  const persona = personas.find((item) => item.id === bug.personaId);
  const steps = normalizeReproductionSteps(bug.reproductionStepsJson);
  const evidence = parseJson<{ screenshots?: string[]; consoleErrors?: string[]; networkErrors?: string[]; summary?: string }>(bug.evidenceJson, {});
  const screenshots = evidence.screenshots ?? [];

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.045] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{bug.title}</h3>
          <p className="mt-1 text-sm text-white/50">{persona?.name ?? "General finding"} / {bug.category} / {bug.status}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${severityClass[bug.severity] ?? severityClass.low}`}>
          {bug.severity}
        </span>
      </div>

      {screenshots.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {screenshots.slice(0, 2).map((src) => (
            <button key={src} onClick={() => onOpenScreenshot(src)} className="group relative overflow-hidden rounded-md border border-white/10 bg-black/40 text-left">
              <Image
                src={src}
                alt="Argus evidence screenshot"
                width={720}
                height={405}
                className="aspect-video w-full object-cover transition group-hover:scale-[1.02]"
                unoptimized
              />
              <span className="absolute right-2 top-2 rounded-md bg-black/65 p-2 opacity-0 transition group-hover:opacity-100">
                <Expand className="h-4 w-4 text-acid" />
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 rounded-md border border-white/10 bg-black/24 p-4">
        <p className="mb-2 text-sm font-semibold text-white/80">Reproduction steps</p>
        {steps.length ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-white/62">
            {steps.slice(0, 7).map((step, index) => (
              <li key={`${step}-${index}`}>{step}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm leading-6 text-white/50">No structured reproduction steps were returned. Use the evidence screenshots and suggested fix to reproduce this finding.</p>
        )}
      </div>

      <p className="mt-4 text-sm leading-6 text-white/68">{bug.suggestedFix}</p>
      {bug.patchSuggestion ? (
        <pre className="mt-4 max-h-72 overflow-auto rounded-md border border-white/10 bg-black/60 p-3 text-xs leading-5 text-white/70">{bug.patchSuggestion}</pre>
      ) : null}
    </article>
  );
}

function normalizeReproductionSteps(value: string) {
  const parsed = parseJson<unknown>(value, value);
  const rawSteps = extractStepCandidates(parsed);
  return rawSteps
    .map((step) => step.replace(/^\s*\d+[\).\s-]+/, "").trim())
    .filter(Boolean)
    .filter((step, index, list) => list.indexOf(step) === index);
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

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractStepCandidates(item));
  }

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

function ScreenshotLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-4" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/14 bg-white/10 hover:bg-white/15"
        aria-label="Close screenshot"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="max-h-[92vh] max-w-6xl overflow-auto rounded-lg border border-white/12 bg-black" onClick={(event) => event.stopPropagation()}>
        <Image src={src} alt="Expanded Argus evidence screenshot" width={1600} height={1000} className="h-auto w-full" unoptimized />
      </div>
    </div>
  );
}
