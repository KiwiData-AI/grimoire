import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GrimoireConfig } from "../utils/config.js";
import type { StepResult } from "./check.js";

const execFileAsync = promisify(execFile);

async function tryRadon(root: string): Promise<{ output: string; hasHighComplexity: boolean } | null> {
  try {
    await execFileAsync("which", ["radon"]);
    const { stdout, stderr } = await execFileAsync("sh", [
      "-c",
      "radon cc . -a -nc --exclude 'node_modules,.venv,dist,migrations' 2>&1 || true",
    ], { cwd: root, timeout: 60_000 });
    const output = (stdout + stderr).trim();
    const hasHighComplexity = /\b[C-F]\s+\(\d+\)/.test(output) || /\b[C-F]\b/.test(output);
    return { output, hasHighComplexity };
  } catch {
    return null;
  }
}

async function tryEslintComplexity(root: string): Promise<{ output: string; hasWarnings: boolean } | null> {
  try {
    await execFileAsync("which", ["npx"]);
    const { stdout, stderr } = await execFileAsync("sh", [
      "-c",
      "npx eslint --rule 'complexity: [warn, 10]' --ext .ts,.tsx,.js,.jsx src/ 2>&1 || true",
    ], { cwd: root, timeout: 60_000 });
    const output = (stdout + stderr).trim();
    // Match ESLint complexity rule output ("  complexity" at end of warning line).
    // Avoids false positives from parsing errors or unrelated warnings.
    const hasWarnings = / complexity$/m.test(output);
    return { output, hasWarnings };
  } catch {
    return null;
  }
}

async function checkPythonComplexity(root: string, start: number): Promise<StepResult | null> {
  const radon = await tryRadon(root);
  if (!radon) return null;
  return {
    step: "complexity",
    status: radon.hasHighComplexity ? "fail" : "pass",
    duration: Date.now() - start,
    output: radon.output || "No high-complexity functions found.",
  };
}

async function checkJsComplexity(root: string, start: number): Promise<StepResult | null> {
  const eslint = await tryEslintComplexity(root);
  if (!eslint) return null;
  return {
    step: "complexity",
    status: eslint.hasWarnings ? "fail" : "pass",
    duration: Date.now() - start,
    output: eslint.output || "No high-complexity functions found.",
  };
}

export async function runComplexityStep(root: string, config: GrimoireConfig): Promise<StepResult> {
  const start = Date.now();
  const lang = config.project.language;

  if (!lang || lang === "python") {
    const result = await checkPythonComplexity(root, start);
    if (result) return result;
  }

  if (!lang || ["typescript", "javascript"].includes(lang ?? "")) {
    const result = await checkJsComplexity(root, start);
    if (result) return result;
  }

  return {
    step: "complexity",
    status: "skip",
    duration: Date.now() - start,
    output: "",
    reason: "no complexity tool found (install radon for Python or eslint for JS/TS)",
  };
}
