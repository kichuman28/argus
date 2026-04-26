import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const argusRoot = resolveArgusRoot();

export function argusPath(...parts: string[]) {
  return path.join(argusRoot, ...parts);
}

function resolveArgusRoot() {
  const explicitRoot = process.env.ARGUS_HOME?.trim();
  if (explicitRoot) return path.resolve(explicitRoot);

  return findProjectRoot(process.cwd()) ?? findProjectRoot(moduleDir) ?? process.cwd();
}

function findProjectRoot(start: string) {
  let current = path.resolve(start);
  while (true) {
    const manifestPath = path.join(current, "package.json");
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { name?: string };
        if (manifest.name === "argus") return current;
      } catch {
        // Keep walking; a malformed package file should not stop startup.
      }
    }

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
