import { NextResponse } from "next/server";
import { getRun } from "@/lib/db";
import { verifyRunInBackground } from "@/lib/runner";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const run = getRun(params.id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const started = verifyRunInBackground(params.id);
  return NextResponse.json({ started });
}
