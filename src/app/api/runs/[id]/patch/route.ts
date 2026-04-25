import { NextResponse } from "next/server";
import { getBugs, getRun, updateBugPatch } from "@/lib/db";
import { generatePatchSuggestion } from "@/lib/patcher";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const run = getRun(params.id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const bugs = getBugs(params.id);
  const patch = generatePatchSuggestion(run, bugs);
  updateBugPatch(params.id, patch);
  return NextResponse.json({ patch });
}
