import { z } from "zod";
import { discoveryAwareFallbackPersonas } from "./personas";
import type { FailureAnalysisInput, GeneratedBug, GeneratedPersona, RunMode, WebsiteDiscovery } from "./types";
import { stringifyJson } from "./json";

const personaSchema = z.object({
  personas: z.array(
    z.object({
      name: z.string(),
      goal: z.string(),
      behavior: z.string(),
      viewport: z.string(),
      riskType: z.string()
    })
  )
});

const bugSchema = z.object({
  bugs: z.array(
    z.object({
      personaId: z.string().nullable(),
      title: z.string(),
      severity: z.enum(["low", "medium", "high", "critical"]),
      category: z.enum(["ux", "functional", "performance", "accessibility", "security", "unknown"]),
      reproductionStepsJson: z.string(),
      evidenceJson: z.string(),
      suggestedFix: z.string(),
      patchSuggestion: z.string().nullable()
    })
  )
});

const siteDescriptionSchema = z.object({
  description: z.string().min(1)
});

function responseSchemaFor(schemaName: string) {
  if (schemaName === "argus_personas") {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        personas: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              goal: { type: "string" },
              behavior: { type: "string" },
              viewport: { type: "string" },
              riskType: { type: "string" }
            },
            required: ["name", "goal", "behavior", "viewport", "riskType"]
          }
        }
      },
      required: ["personas"]
    };
  }

  if (schemaName === "argus_bugs") {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        bugs: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              personaId: { type: ["string", "null"] },
              title: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
              category: {
                type: "string",
                enum: ["ux", "functional", "performance", "accessibility", "security", "unknown"]
              },
              reproductionStepsJson: { type: "string" },
              evidenceJson: { type: "string" },
              suggestedFix: { type: "string" },
              patchSuggestion: { type: ["string", "null"] }
            },
            required: [
              "personaId",
              "title",
              "severity",
              "category",
              "reproductionStepsJson",
              "evidenceJson",
              "suggestedFix",
              "patchSuggestion"
            ]
          }
        }
      },
      required: ["bugs"]
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      description: { type: "string" }
    },
    required: ["description"]
  };
}

async function responsesJson<T>(prompt: string, schemaName: string): Promise<T | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.log(`[Argus AI] ${schemaName}: OPENAI_API_KEY missing, skipping OpenAI.`);
    return null;
  }
  console.log(`[Argus AI] ${schemaName}: requesting structured output with ${process.env.OPENAI_MODEL ?? "gpt-4.1-mini"}.`);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          schema: responseSchemaFor(schemaName),
          strict: true
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn(`[Argus AI] ${schemaName}: OpenAI request failed with ${response.status}. ${body.slice(0, 240)}`);
    return null;
  }
  const data = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).find((content) => content.text)?.text;
  if (!text) {
    console.warn(`[Argus AI] ${schemaName}: OpenAI response did not include output text.`);
    return null;
  }
  console.log(`[Argus AI] ${schemaName}: received structured output.`);
  return JSON.parse(text) as T;
}

export async function generateWebsiteDescription(url: string, discovery: WebsiteDiscovery): Promise<string | null> {
  const prompt = `Argus has completed a browser discovery pass for ${url}.
Return structured JSON with a concise website description in the "description" field.

Requirements:
- One or two sentences.
- Describe what the website appears to be for, based only on the discovery data.
- Mention important visible flows, such as auth, pricing, checkout, search, dashboards, forms, or docs, only when supported by the data.
- Do not invent company claims, hidden features, or unavailable pages.

Website discovery JSON:
${stringifyJson({
  title: discovery.title,
  metaDescription: discovery.description,
  headings: discovery.headings,
  buttons: discovery.buttons,
  routes: discovery.routes,
  forms: discovery.forms,
  keywords: discovery.keywords,
  accessibilityHints: discovery.accessibilityHints
})}`;

  try {
    const result = await responsesJson<unknown>(prompt, "argus_site_description");
    const parsed = siteDescriptionSchema.safeParse(result);
    if (parsed.success) {
      console.log("[Argus AI] Site description: using OpenAI output.");
      return parsed.data.description.trim();
    }
    console.warn("[Argus AI] Site description: OpenAI output was missing or invalid.");
  } catch {
    console.warn("[Argus AI] Site description: OpenAI generation threw.");
  }
  return null;
}

export async function generatePersonas(url: string, mode: RunMode, discovery: WebsiteDiscovery | null): Promise<GeneratedPersona[]> {
  const prompt = `Create ${mode === "chaos" ? 20 : 8} synthetic QA personas for Argus testing ${url}.
Return only structured JSON. Make them concrete, hackathon-demo useful, and biased toward finding UX, functional, accessibility, and security-ish failures.

Website discovery summary:
${stringifyJson(discovery)}

Prefer personas whose goals map to discovered routes, forms, buttons, and product language. Include mobile navigation, keyboard, accessibility, malicious input, and conversion checks when relevant.`;
  try {
    const result = await responsesJson<unknown>(prompt, "argus_personas");
    const parsed = personaSchema.safeParse(result);
    if (parsed.success && parsed.data.personas.length >= 8) {
      console.log(`[Argus AI] Personas: using OpenAI output (${parsed.data.personas.length} generated).`);
      return parsed.data.personas.slice(0, mode === "chaos" ? 20 : 8);
    }
    console.warn("[Argus AI] Personas: OpenAI output was missing or invalid, using discovery-aware fallback.");
  } catch {
    console.warn("[Argus AI] Personas: OpenAI generation threw, using discovery-aware fallback.");
    return discoveryAwareFallbackPersonas(mode, discovery);
  }
  console.log("[Argus AI] Personas: using discovery-aware fallback.");
  return discoveryAwareFallbackPersonas(mode, discovery);
}

export async function analyzeFailuresWithAi(input: FailureAnalysisInput): Promise<GeneratedBug[] | null> {
  const condensed = input.results.map((result) => ({
    personaId: result.personaId,
    status: result.status,
    summary: result.summary,
    steps: JSON.parse(result.stepsJson),
    screenshots: JSON.parse(result.screenshotsJson),
    consoleErrors: JSON.parse(result.consoleErrorsJson),
    networkErrors: JSON.parse(result.networkErrorsJson)
  }));
  const prompt = `Argus tested ${input.url} in ${input.mode} mode.
Generate polished bug cards from this Playwright trace summary. Prefer concrete evidence and reproduction steps.
If there are no real failures, return low severity warnings for risks worth showing in a demo.
Website discovery summary:
${stringifyJson(input.discovery)}

Trace JSON:
${stringifyJson(condensed)}`;
  try {
    const result = await responsesJson<unknown>(prompt, "argus_bugs");
    const parsed = bugSchema.safeParse(result);
    if (parsed.success) {
      console.log(`[Argus AI] Bug analysis: using OpenAI output (${parsed.data.bugs.length} bug cards).`);
      return parsed.data.bugs;
    }
    console.warn("[Argus AI] Bug analysis: OpenAI output was missing or invalid, using heuristic analysis.");
  } catch {
    console.warn("[Argus AI] Bug analysis: OpenAI analysis threw, using heuristic analysis.");
    return null;
  }
  return null;
}
