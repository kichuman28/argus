import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import type { WebsiteDiscovery } from "./types";
import { argusPath } from "./paths";

export async function discoverWebsite(runId: string, url: string): Promise<WebsiteDiscovery> {
  const fallback = fallbackDiscovery(url);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    page.setDefaultTimeout(5000);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => undefined);

    const screenshotPath = await captureDiscoveryScreenshot(page, runId);
    const data = await page.evaluate(() => {
      const visibleText = (element: Element) => (element.textContent ?? "").replace(/\s+/g, " ").trim();
      const limit = <T,>(items: T[], count: number) => items.slice(0, count);
      const title = document.title || visibleText(document.querySelector("h1") ?? document.body).slice(0, 80);
      const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "";
      const headings = limit(
        Array.from(document.querySelectorAll("h1,h2,h3")).map(visibleText).filter(Boolean),
        14
      );
      const buttons = limit(
        Array.from(document.querySelectorAll("button,[role='button'],input[type='submit'],input[type='button']"))
          .map((element) => visibleText(element) || element.getAttribute("aria-label") || element.getAttribute("value") || "")
          .filter(Boolean),
        24
      );
      const links = limit(
        Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
          .map((anchor) => ({ text: visibleText(anchor) || anchor.getAttribute("aria-label") || anchor.href, href: anchor.href }))
          .filter((link) => link.href),
        32
      );
      const forms = limit(
        Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select")).map((input) => {
          const id = input.getAttribute("id");
          const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() ?? "" : "";
          return {
            label: label || input.getAttribute("aria-label") || "",
            type: input.getAttribute("type") || input.tagName.toLowerCase(),
            name: input.getAttribute("name") || "",
            placeholder: input.getAttribute("placeholder") || ""
          };
        }),
        24
      );
      const accessibilityHints: string[] = [];
      const unnamedInputs = forms.filter((form) => !form.label && !form.placeholder).length;
      const unnamedButtons = buttons.filter((button) => !button.trim()).length;
      const imagesWithoutAlt = Array.from(document.images).filter((image) => !image.alt).length;
      if (unnamedInputs) accessibilityHints.push(`${unnamedInputs} input(s) appear to be unnamed.`);
      if (unnamedButtons) accessibilityHints.push(`${unnamedButtons} button(s) appear to be icon-only without names.`);
      if (imagesWithoutAlt) accessibilityHints.push(`${imagesWithoutAlt} image(s) are missing alt text.`);
      return { title, description, headings, buttons, links, forms, accessibilityHints };
    });

    const routes = Array.from(
      new Set(
        data.links
          .map((link) => {
            try {
              return new URL(link.href).pathname;
            } catch {
              return "";
            }
          })
          .filter(Boolean)
      )
    ).slice(0, 24);

    return {
      ...data,
      aiDescription: null,
      routes,
      screenshotPath,
      keywords: keywordSignals([data.title, data.description, ...data.headings, ...data.buttons, ...routes].join(" "))
    };
  } catch {
    return fallback;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export function fallbackDiscovery(url: string): WebsiteDiscovery {
  return {
    title: new URL(url).hostname,
    description: "",
    aiDescription: null,
    headings: [],
    buttons: [],
    links: [],
    forms: [],
    routes: [],
    keywords: [],
    accessibilityHints: [],
    screenshotPath: null
  };
}

async function captureDiscoveryScreenshot(page: { screenshot: (options: { path: string; fullPage: boolean }) => Promise<Buffer> }, runId: string) {
  const fileName = `discovery-${Date.now()}.png`;
  const diskPath = argusPath("public", "runs", runId, fileName);
  fs.mkdirSync(path.dirname(diskPath), { recursive: true });
  await page.screenshot({ path: diskPath, fullPage: true });
  return `/runs/${runId}/${fileName}`;
}

function keywordSignals(text: string) {
  const lower = text.toLowerCase();
  const candidates = [
    "signup",
    "login",
    "checkout",
    "pricing",
    "search",
    "dashboard",
    "cart",
    "coupon",
    "campaign",
    "modal",
    "contact",
    "docs",
    "upload",
    "settings"
  ];
  return candidates.filter((candidate) => lower.includes(candidate));
}
