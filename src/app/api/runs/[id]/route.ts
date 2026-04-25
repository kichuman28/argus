import { NextResponse } from "next/server";
import { getRunBundle } from "@/lib/db";
import { isRunActive } from "@/lib/runner";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const bundle = getRunBundle(params.id);
  if (!bundle) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  return NextResponse.json({ ...bundle, active: isRunActive(params.id) });
}
