import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getLatestRunBundle, getRecentRuns, getRunBundle } from "../lib/db";
import { stringifyJson } from "../lib/json";
import { buildBugReport, buildFixBrief, buildRunReport } from "../lib/repairBrief";
import type { RunBundle } from "../lib/types";

const server = new McpServer({
  name: "argus",
  version: "0.1.0"
});

server.registerTool(
  "argus_list_runs",
  {
    title: "List Argus runs",
    description: "List recent Argus QA runs with target URL, status, mode, bug count, and created time.",
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional().default(10).describe("Maximum number of recent runs to return.")
    }
  },
  async ({ limit = 10 }) => {
    const runs = getRecentRuns(limit);
    return jsonToolResult({
      runs,
      count: runs.length,
      message: runs.length ? "Recent Argus runs." : "No Argus runs found. Launch Argus against a target URL first."
    });
  }
);

server.registerTool(
  "argus_get_run_report",
  {
    title: "Get Argus run report",
    description: "Return a structured Argus run report with discovery, personas, scenario results, bug cards, and evidence paths.",
    inputSchema: {
      runId: z.string().optional().describe("Argus run ID. If omitted, the latest run is returned.")
    }
  },
  async ({ runId }) => {
    const bundle = resolveBundle(runId);
    if (!bundle) return missingRunResult(runId);
    const report = buildRunReport(bundle);
    return jsonToolResult(report);
  }
);

server.registerTool(
  "argus_get_fix_brief",
  {
    title: "Get Codex repair brief",
    description: "Return a Codex-ready repair brief from Argus findings for the latest or selected run.",
    inputSchema: {
      runId: z.string().optional().describe("Argus run ID. If omitted, the latest run is used.")
    }
  },
  async ({ runId }) => {
    const bundle = resolveBundle(runId);
    if (!bundle) return missingRunResult(runId);
    const brief = buildFixBrief(bundle);
    return {
      content: [{ type: "text" as const, text: brief }],
      structuredContent: {
        runId: bundle.run.id,
        targetUrl: bundle.run.url,
        brief
      }
    };
  }
);

server.registerResource(
  "argus-latest-run",
  "argus://runs/latest",
  {
    title: "Latest Argus run",
    description: "Structured report for the latest Argus run.",
    mimeType: "application/json"
  },
  async (uri) => resourceJson(uri.toString(), latestRunResource())
);

server.registerResource(
  "argus-run",
  new ResourceTemplate("argus://runs/{runId}", {
    list: async () => ({
      resources: getRecentRuns(20).map((run) => ({
        uri: `argus://runs/${run.id}`,
        name: `Argus run ${run.id}`,
        title: `${run.status} ${run.mode} run for ${run.url}`,
        description: `${run.bugCount} bug card(s), created ${run.createdAt}`,
        mimeType: "application/json"
      }))
    })
  }),
  {
    title: "Argus run report",
    description: "Structured report for a specific Argus run.",
    mimeType: "application/json"
  },
  async (uri, variables) => {
    const runId = variableValue(variables.runId);
    const bundle = getRunBundle(runId);
    return resourceJson(uri.toString(), bundle ? buildRunReport(bundle) : { error: `Argus run not found: ${runId}` });
  }
);

server.registerResource(
  "argus-bugs",
  new ResourceTemplate("argus://bugs/{runId}", {
    list: async () => ({
      resources: getRecentRuns(20).map((run) => ({
        uri: `argus://bugs/${run.id}`,
        name: `Argus bugs ${run.id}`,
        title: `Bug cards for ${run.url}`,
        description: `${run.bugCount} bug card(s), run status ${run.status}`,
        mimeType: "application/json"
      }))
    })
  }),
  {
    title: "Argus bug cards",
    description: "Prioritized bug cards for a specific Argus run.",
    mimeType: "application/json"
  },
  async (uri, variables) => {
    const runId = variableValue(variables.runId);
    const bundle = getRunBundle(runId);
    return resourceJson(uri.toString(), bundle ? buildBugReport(bundle) : { error: `Argus run not found: ${runId}` });
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function resolveBundle(runId: string | undefined): RunBundle | null {
  if (runId?.trim()) return getRunBundle(runId.trim());
  return getLatestRunBundle();
}

function latestRunResource() {
  const bundle = getLatestRunBundle();
  return bundle ? buildRunReport(bundle) : { error: "No Argus runs found. Launch Argus against a target URL first." };
}

function jsonToolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: stringifyJson(value) }],
    structuredContent: value
  };
}

function missingRunResult(runId: string | undefined) {
  const message = runId?.trim()
    ? `Argus run not found: ${runId.trim()}`
    : "No Argus runs found. Launch Argus against a target URL first.";
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
    structuredContent: { error: message }
  };
}

function resourceJson(uri: string, value: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: stringifyJson(value)
      }
    ]
  };
}

function variableValue(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return String(value ?? "");
}

main().catch((error) => {
  console.error("[Argus MCP] server failed", error);
  process.exit(1);
});
