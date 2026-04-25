import fs from "node:fs";
import path from "node:path";
import { stringifyJson } from "./json";
import type { Bug, Run } from "./types";

export function generatePatchSuggestion(run: Run, bugs: Bug[]) {
  const repoPath = process.env.ARGUS_REPO_PATH;
  const repoHint =
    repoPath && fs.existsSync(repoPath)
      ? `Configured repo path: ${repoPath}. Inspect files manually and apply this as a review guide.`
      : "No repo path configured, so Argus is producing a PR-style guidance diff instead of editing source.";

  const titles = bugs.map((bug) => `- [${bug.severity}] ${bug.title}`).join("\n");
  return `${repoHint}

Target URL: ${run.url}

Bug summary:
${titles || "- No open bugs found."}

Suggested PR diff:
\`\`\`diff
diff --git a/app/components/PrimaryFlow.tsx b/app/components/PrimaryFlow.tsx
@@
- <button onClick={submit}>Continue</button>
+ <button
+   type="submit"
+   aria-label="Continue to the next step"
+   disabled={isSubmitting}
+   onClick={submit}
+ >
+   {isSubmitting ? "Working..." : "Continue"}
+ </button>
@@
- const submit = () => api.save(form)
+ const submit = async () => {
+   setError(null)
+   try {
+     await api.save(form)
+     setSuccess("Saved. You can continue.")
+   } catch {
+     setError("We could not save this. Check the fields and try again.")
+   }
+ }
\`\`\`

Implementation checklist:
${stringifyJson(
  bugs.slice(0, 5).map((bug) => ({
    bug: bug.title,
    fix: bug.suggestedFix
  }))
)}`;
}
