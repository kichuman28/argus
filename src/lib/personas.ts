import type { GeneratedPersona, RunMode, WebsiteDiscovery } from "./types";

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

export function discoveryAwareFallbackPersonas(mode: RunMode, discovery: WebsiteDiscovery | null): GeneratedPersona[] {
  const fallback = fallbackPersonas(mode);
  if (!discovery) return fallback;
  const keywords = new Set(discovery.keywords);
  const routesAndButtons = [...discovery.routes, ...discovery.buttons, ...discovery.headings].join(" ").toLowerCase();
  const tailored: GeneratedPersona[] = [];

  if (keywords.has("signup") || routesAndButtons.includes("sign")) {
    tailored.push({
      name: "Nova, Signup Path Breaker",
      goal: "Create an account and challenge validation rules discovered on the site.",
      behavior: "Uses visible signup CTAs, mismatched passwords, invalid emails, missing terms, and double submits.",
      viewport: "desktop",
      riskType: "onboarding"
    });
  }
  if (keywords.has("login") || routesAndButtons.includes("log in")) {
    tailored.push({
      name: "Rey, Returning Login User",
      goal: "Log in, recover password, and check error handling.",
      behavior: "Submits wrong credentials, tries forgot-password links, and watches loading states.",
      viewport: "desktop",
      riskType: "authentication"
    });
  }
  if (keywords.has("checkout") || keywords.has("cart") || keywords.has("pricing") || keywords.has("coupon")) {
    tailored.push({
      name: "Pia, Checkout Buyer",
      goal: "Reach checkout, change purchase details, and test payment-like fields.",
      behavior: "Clicks pricing or cart links, applies coupon-like values, and fills card-shaped inputs.",
      viewport: "desktop",
      riskType: "conversion"
    });
  }
  if (keywords.has("search")) {
    tailored.push({
      name: "Lex, Search Injection Tester",
      goal: "Search with empty, markup-like, and SQL-like queries.",
      behavior: "Submits blank searches and suspicious strings, then checks reflected output.",
      viewport: "desktop",
      riskType: "security"
    });
  }
  if (keywords.has("dashboard") || keywords.has("campaign") || keywords.has("modal")) {
    tailored.push({
      name: "Mina, Dashboard Operator",
      goal: "Open dashboard workflows, create items, and test modal behavior.",
      behavior: "Clicks create/edit/delete controls, presses Escape in modals, and checks labels.",
      viewport: "desktop",
      riskType: "functional"
    });
  }
  if (discovery.accessibilityHints.length || discovery.forms.length) {
    tailored.push({
      name: "Orin, Accessibility Reviewer",
      goal: "Review form names, button labels, images, modal semantics, and keyboard reachability.",
      behavior: "Tabs through controls, inspects accessible names, and checks missing labels.",
      viewport: "desktop",
      riskType: "accessibility"
    });
  }

  tailored.push({
    name: "Mika, Mobile Navigation User",
    goal: "Use the discovered navigation on a narrow phone viewport.",
    behavior: "Opens mobile menus, taps visible nav items, and watches for overlap or clipped controls.",
    viewport: "mobile",
    riskType: "responsive"
  });

  const unique = [...tailored, ...fallback].filter(
    (persona, index, list) => list.findIndex((candidate) => candidate.name === persona.name) === index
  );
  return unique.slice(0, mode === "chaos" ? 20 : 8);
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
