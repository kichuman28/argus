import { NextResponse } from "next/server";
import { createRun, insertPersonas, normalizeMode } from "@/lib/db";
import { createId, nowIso } from "@/lib/ids";
import { generatePersonas } from "@/lib/openai";
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
      finishedAt: null
    };
    createRun(run);
    const generated = await generatePersonas(url, mode);
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
