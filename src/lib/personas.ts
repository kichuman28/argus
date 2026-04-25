import type { GeneratedPersona, RunMode } from "./types";

const basePersonas: GeneratedPersona[] = [
  {
    name: "Maya, First-Time Founder",
    goal: "Find the sign-up path and create an account.",
    behavior: "Scans hero copy, clicks primary CTAs, fills sign-up forms with normal data.",
    viewport: "desktop",
    riskType: "onboarding"
  },
  {
    name: "Nico, Returning User",
    goal: "Log in and reach an authenticated dashboard or account area.",
    behavior: "Looks for login links, uses remembered credentials, notices broken auth messaging.",
    viewport: "desktop",
    riskType: "authentication"
  },
  {
    name: "Tara, Small-Screen Mobile User",
    goal: "Complete the main task on a narrow phone viewport.",
    behavior: "Uses touch-sized targets, menu buttons, and short scrolling bursts.",
    viewport: "mobile",
    riskType: "responsive"
  },
  {
    name: "Ben, Confused Clicker",
    goal: "Try to discover the purpose of the product while clicking secondary controls.",
    behavior: "Clicks ambiguous buttons, footer links, nav labels, and repeated CTAs.",
    viewport: "desktop",
    riskType: "ux"
  },
  {
    name: "Ari, Checkout Buyer",
    goal: "Add something to cart and reach checkout or pricing.",
    behavior: "Searches for products, plans, pricing, carts, and purchase CTAs.",
    viewport: "desktop",
    riskType: "conversion"
  },
  {
    name: "Vex, Weird Input Attacker",
    goal: "Probe forms with suspicious strings and boundary inputs.",
    behavior: "Enters script tags, SQL-looking strings, long text, symbols, and invalid emails.",
    viewport: "desktop",
    riskType: "security"
  },
  {
    name: "June, Keyboard-Only Sprinter",
    goal: "Use the site without a mouse and move quickly through focusable elements.",
    behavior: "Tabs, presses Enter, expects visible focus and reachable forms.",
    viewport: "desktop",
    riskType: "keyboard"
  },
  {
    name: "Sam, Accessibility-Sensitive Reviewer",
    goal: "Check labels, headings, alt hints, contrast clues, and form affordances.",
    behavior: "Inspects accessible names, missing labels, placeholder-only inputs, and disabled-looking CTAs.",
    viewport: "desktop",
    riskType: "accessibility"
  }
];

const chaosExtras: GeneratedPersona[] = [
  ["Pat, Offline-ish Commuter", "Click through while network failures are likely.", "Reloads, retries links, and distrusts spinners.", "mobile", "network"],
  ["Ivy, Paste-Heavy Operator", "Paste huge payloads into every input.", "Uses long strings, emoji-free symbols, and whitespace storms.", "desktop", "forms"],
  ["Omar, Back Button Masher", "Navigate forward and backward until state breaks.", "Clicks CTA, back, forward, reload, then repeats.", "desktop", "navigation"],
  ["Lee, Tiny Laptop User", "Use the app in a cramped 1024px wide window.", "Looks for clipped modals, overflowing nav, and hidden buttons.", "tablet", "responsive"],
  ["Rin, Modal Escape Artist", "Open overlays and try to close them.", "Presses Escape, clicks outside, and checks focus return.", "desktop", "ux"],
  ["Kai, Empty-State Hunter", "Submit forms blank or half-complete.", "Looks for validation, error copy, and disabled button traps.", "desktop", "forms"],
  ["Sol, Localization Stressor", "Use names and addresses with uncommon punctuation.", "Enters accented-looking transliterations, hyphens, apostrophes, and long city names.", "desktop", "i18n"],
  ["Bea, Pricing Skeptic", "Compare pricing, docs, and legal links.", "Clicks low-prominence links and checks if they dead-end.", "desktop", "content"],
  ["Quinn, Touch Target Tester", "Tap dense controls on a small phone.", "Uses mobile viewport and rapid repeated taps.", "mobile", "mobile"],
  ["Noor, Slow Reader", "Scroll carefully and inspect content structure.", "Looks for repeated headings, dead anchors, and missing context.", "desktop", "content"],
  ["Drew, Multi-Submitter", "Submit the same form multiple times.", "Double-clicks submit buttons and retries after validation.", "desktop", "forms"],
  ["Ash, Search Power User", "Use search/filter inputs if present.", "Types partial queries, clears fields, and checks results feedback.", "desktop", "search"]
].map(([name, goal, behavior, viewport, riskType]) => ({
  name,
  goal,
  behavior,
  viewport,
  riskType
})) as GeneratedPersona[];

export function fallbackPersonas(mode: RunMode): GeneratedPersona[] {
  return mode === "chaos" ? [...basePersonas, ...chaosExtras].slice(0, 20) : basePersonas;
}

export function viewportForPersona(viewport: string) {
  if (viewport.includes("mobile")) return { width: 390, height: 844 };
  if (viewport.includes("tablet")) return { width: 820, height: 1180 };
  if (viewport.includes("small")) return { width: 1024, height: 720 };
  return { width: 1440, height: 980 };
}

export function inputForRisk(riskType: string, index: number) {
  const weird = [
    "<script>alert('argus')</script>",
    "' OR '1'='1",
    "     ",
    "argus-" + "x".repeat(160),
    "not-an-email"
  ];
  if (riskType === "security") return weird[index % weird.length];
  if (riskType === "authentication") return index % 2 ? "correct-horse-battery" : "returning@example.com";
  if (riskType === "conversion") return index % 2 ? "4242 4242 4242 4242" : "Argus Buyer";
  return index % 2 ? "qa@example.com" : "Argus Test User";
}
