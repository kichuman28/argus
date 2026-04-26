import { NextResponse } from "next/server";
import { argusRoot } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId")?.trim();
  const publicUrl = resolvePublicUrl(request);
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = ["--prefix", argusRoot, "run", "mcp"];
  const env = {
    ARGUS_HOME: argusRoot,
    ARGUS_PUBLIC_URL: publicUrl
  };
  const server = {
    type: "stdio",
    command,
    args,
    env
  };

  return NextResponse.json({
    name: "argus",
    transport: "stdio",
    argusRoot,
    publicUrl,
    command,
    args,
    env,
    vscodeMcpJson: JSON.stringify({ servers: { argus: server } }, null, 2),
    codexPrompt: buildCodexPrompt(runId)
  });
}

function resolvePublicUrl(request: Request) {
  const configured = process.env.ARGUS_PUBLIC_URL ?? process.env.NEXT_PUBLIC_ARGUS_BASE_URL;
  if (configured?.trim()) return configured.trim().replace(/\/$/, "");
  const origin = request.headers.get("origin");
  if (origin?.trim()) return origin.trim().replace(/\/$/, "");
  return new URL(request.url).origin.replace(/\/$/, "");
}

function buildCodexPrompt(runId: string | undefined) {
  const runTarget = runId ? `runId "${runId}"` : "the latest run";
  return `Use the Argus MCP server. Call argus_get_fix_brief for ${runTarget}, inspect this target repo, make the smallest real fix for the reported findings, run the normal checks, then tell me to return to Argus and click Verify fixes.`;
}
