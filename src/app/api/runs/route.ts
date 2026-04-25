import { NextResponse } from "next/server";
import { createRun, insertPersonas, insertRunEvent, normalizeMode, updateRunDiscovery } from "@/lib/db";
import { discoverWebsite } from "@/lib/discovery";
import { createId, nowIso } from "@/lib/ids";
import { generatePersonas } from "@/lib/openai";
import { stringifyJson } from "@/lib/json";
import type { Run } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string; mode?: string };
    const url = normalizeUrl(body.url);
    const mode = normalizeMode(body.mode);
    const run: Run = {
      id: createId("run"),
      url,
      mode,
      status: "queued",
      createdAt: nowIso(),
      finishedAt: null,
      discoveryJson: null
    };
    createRun(run);
    console.log(`[Argus Run] ${run.id}: created ${mode} run for ${url}.`);
    console.log(`[Argus Discovery] ${run.id}: scouting target site.`);
    const discovery = await discoverWebsite(run.id, url);
    console.log(
      `[Argus Discovery] ${run.id}: found ${discovery.routes.length} route(s), ${discovery.forms.length} input(s), ${discovery.buttons.length} action(s).`
    );
    updateRunDiscovery(run.id, stringifyJson(discovery));
    insertRunEvent({
      id: createId("event"),
      runId: run.id,
      personaId: null,
      kind: "discovery",
      message: `Scouted ${discovery.title || url}: ${discovery.routes.length} routes, ${discovery.forms.length} inputs, ${discovery.buttons.length} actions.`,
      screenshotPath: discovery.screenshotPath,
      createdAt: nowIso()
    });
    console.log(`[Argus Personas] ${run.id}: generating ${mode === "chaos" ? 20 : 8} persona(s).`);
    const generated = await generatePersonas(url, mode, discovery);
    console.log(`[Argus Personas] ${run.id}: saved ${generated.length} persona(s).`);
    insertPersonas(
      generated.map((persona) => ({
        id: createId("persona"),
        runId: run.id,
        ...persona
      }))
    );
    return NextResponse.json({ runId: run.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create run" },
      { status: 400 }
    );
  }
}

function normalizeUrl(raw?: string) {
  if (!raw) throw new Error("Enter a website URL.");
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https URLs are supported.");
  return url.toString();
}
