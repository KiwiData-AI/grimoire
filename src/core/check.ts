import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { simpleGit } from "simple-git";
import fg from "fast-glob";
import { loadConfig, type GrimoireConfig, type ToolConfig } from "../utils/config.js";
import { findProjectRoot } from "../utils/paths.js";
import { spawnWithStdin } from "../utils/spawn.js";
import { analyzeTestQuality, TEST_FILE_GLOBS, TEST_FILE_IGNORE } from "./test-quality.js";
import { checkDocStyle } from "./doc-style.js";
import { loadAcceptedRiskIds, partitionAdvisories } from "./risk-register.js";

// Steps whose tool emits CVE/GHSA advisory ids in its output and can therefore
// be suppressed by the risk-acceptance register (.grimoire/security/accepted-risks.yml).
// Only meaningful for advisory-id-emitting scanners (npm audit, pip-audit, osv,
// trivy, ...); suppression is a no-op for tools whose failures aren't keyed by a
// CVE/GHSA id, since no ids will match the register.
const REGISTER_AWARE_STEPS = new Set(["dep_audit", "security"]);

const execFileAsync = promisify(execFile);

export interface CheckOptions {
  steps?: string[];
  continueOnFail: boolean;
  changed: boolean;
  skip?: string[];
  json: boolean;
}

interface StepResult {
  step: string;
  status: "pass" | "fail" | "skip" | "error";
  duration: number;
  output: string;
  reason?: string;
}

export interface CheckResult {
  results: StepResult[];
  passed: number;
  failed: number;
  skipped: number;
  errored: number;
}

async function runSteps(
  steps: string[],
  root: string,
  config: GrimoireConfig,
  options: CheckOptions,
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  for (const step of steps) {
    const result = await runStep(step, root, config, options);
    results.push(result);
    if (!options.json) printStepResult(result);
    if (result.status === "fail" && !options.continueOnFail) break;
  }
  return results;
}

function printCheckOutput(
  options: CheckOptions,
  results: StepResult[],
  passed: number,
  failedCount: number,
  skipped: number,
  errored: number,
): void {
  if (options.json) {
    console.log(
      JSON.stringify({ results, summary: { passed, failed: failedCount, skipped, errored } }, null, 2)
    );
  } else {
    const failStr = failedCount > 0 ? chalk.red(`${failedCount} failed`) : `${failedCount} failed`;
    const errStr = errored > 0 ? `, ${errored} errored` : "";
    console.log(`\n  ${chalk.green(`${passed} passed`)}, ${failStr}, ${skipped} skipped${errStr}\n`);
  }
}

export async function runCheck(options: CheckOptions): Promise<CheckResult> {
  const root = await findProjectRoot();
  const config = await loadConfig(root);

  let steps = options.steps?.length ? options.steps : config.checks;
  if (options.skip?.length) {
    const skipSet = new Set(options.skip);
    steps = steps.filter((s) => !skipSet.has(s));
  }

  if (!options.json) console.log(chalk.bold("\ngrimoire check\n"));

  const results = await runSteps(steps, root, config, options);

  const passed = results.filter((r) => r.status === "pass").length;
  const failedCount = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const errored = results.filter((r) => r.status === "error").length;

  printCheckOutput(options, results, passed, failedCount, skipped, errored);

  return { results, passed, failed: failedCount, skipped, errored };
}

function isBuiltinComplexity(tool: ToolConfig | undefined): boolean {
  return !tool?.command && !tool?.check_command && tool?.name !== "llm";
}

async function runToolStep(
  step: string,
  root: string,
  config: GrimoireConfig,
  options: CheckOptions,
): Promise<StepResult> {
  const tool = config.tools[step] ?? getBuiltinLlmFallback(step);
  if (!tool || (!tool.command && !tool.check_command && tool.name !== "llm")) {
    return { step, status: "skip", duration: 0, output: "", reason: "not configured" };
  }
  if (tool.name === "llm") {
    return runLlmStep(step, tool.prompt ?? "", config.llm.coding.command, root, options.changed);
  }
  return runShellStep(step, tool.check_command ?? tool.command!, root);
}

async function runStep(
  step: string,
  root: string,
  config: GrimoireConfig,
  options: CheckOptions,
): Promise<StepResult> {
  if (step === "test_quality") return runTestQualityStep(root);
  if (step === "doc_style") return runDocStyleStep(root, config);
  if (step === "complexity" && isBuiltinComplexity(config.tools[step])) {
    return runComplexityStep(root, config);
  }
  const result = await runToolStep(step, root, config, options);
  if (result.status === "fail" && REGISTER_AWARE_STEPS.has(step)) {
    return applyRiskRegister(result, root);
  }
  return result;
}

/**
 * For a failed vuln-scan step, suppress advisories that are risk-accepted in
 * .grimoire/security/accepted-risks.yml. If every advisory in the output is an
 * unexpired accepted entry, the step passes (with a note). If some remain
 * unaccepted, it still fails — but annotates which were suppressed vs outstanding.
 */
async function applyRiskRegister(result: StepResult, root: string): Promise<StepResult> {
  const acceptedIds = await loadAcceptedRiskIds(root, new Date());
  if (acceptedIds.size === 0) return result;

  const { suppressed, remaining } = partitionAdvisories(result.output, acceptedIds);
  if (suppressed.length === 0) return result; // nothing the register covers

  if (remaining.length > 0) {
    return {
      ...result,
      reason: `${suppressed.length} risk-accepted, ${remaining.length} outstanding`,
      output:
        `${result.output}\n\n[risk-register] ${suppressed.length} suppressed via accepted-risks.yml ` +
        `(${suppressed.join(", ")}); ${remaining.length} still outstanding (${remaining.join(", ")})`,
    };
  }

  return {
    ...result,
    status: "pass",
    reason: `${suppressed.length} advisory(ies) risk-accepted: ${suppressed.join(", ")}`,
  };
}

async function runShellStep(
  step: string,
  command: string,
  root: string
): Promise<StepResult> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync("sh", ["-c", command], {
      cwd: root,
      timeout: 300_000,
    });
    return {
      step,
      status: "pass",
      duration: Date.now() - start,
      output: (stdout + stderr).trim(),
    };
  } catch (err) {
    const duration = Date.now() - start;
    if (err && typeof err === "object" && "stdout" in err) {
      const execErr = err as { stdout: string; stderr: string; code?: number };
      const output = (execErr.stdout + execErr.stderr).trim();
      if (output.includes("command not found") || output.includes("No such file or directory")) {
        return { step, status: "skip", duration, output: "", reason: output.split("\n")[0] };
      }
      return {
        step,
        status: "fail",
        duration,
        output,
      };
    }
    return {
      step,
      status: "error",
      duration,
      output: err instanceof Error ? err.message : String(err),
      reason: "command failed to execute",
    };
  }
}

async function resolveChangedFiles(root: string): Promise<{ files: string[]; diff: string }> {
  try {
    const git = simpleGit(root);
    const nameOnly = await git.diff(["--name-only", "HEAD"]);
    const files = nameOnly.trim().split("\n").filter(Boolean);
    if (files.length > 0) {
      const diff = await git.diff(["HEAD", "--", ...files]);
      return { files, diff };
    }
    const stagedNames = await git.diff(["--name-only", "--cached"]);
    const stagedFiles = stagedNames.trim().split("\n").filter(Boolean);
    const diff = await git.diff(["--cached", "--", ...stagedFiles]);
    return { files: stagedFiles, diff };
  } catch {
    return { files: [], diff: "" };
  }
}

const MAX_DIFF_CHARS = 40_000;

function buildLlmPrompt(prompt: string, files: string[], diff: string): string {
  // Strip newlines and backticks from each filename to prevent prompt injection.
  const safeFiles = files.map((f) => `\`${f.replace(/[\n\r`]/g, "")}\``).filter((f) => f.length > 2);
  const fileList = safeFiles.length > 0 ? `\n\nFiles changed:\n${safeFiles.join("\n")}` : "";
  const safeDiff = diff.replace(/`{3,}/g, "```");
  const diffSection = safeDiff
    ? `\n\nDiff:\n\`\`\`diff\n${safeDiff.slice(0, MAX_DIFF_CHARS)}\n\`\`\``
    : "";
  return `${prompt}${fileList}${diffSection}\n\nOnly flag issues directly observable in the diff above. Do not infer issues from filenames or speculate about code not shown.\n\nRespond with PASS or FAIL as the very first word on the very first line (no markdown, no asterisks, no extra words on that line). Then explain any issues on subsequent lines.`;
}

function parseLlmVerdict(output: string): boolean {
  const firstLine = output.trim().split("\n").map((l) => l.trim()).find(Boolean)?.toUpperCase() ?? "";
  return /\bPASS\b/.test(firstLine) && !/\bFAIL\b/.test(firstLine);
}

async function runLlmStep(
  step: string,
  prompt: string,
  llmCommand: string,
  root: string,
  changedOnly: boolean
): Promise<StepResult> {
  const start = Date.now();

  try {
    await execFileAsync("which", [llmCommand]);
  } catch {
    return { step, status: "skip", duration: Date.now() - start, output: "", reason: `${llmCommand} not found` };
  }

  const { files, diff } = changedOnly ? await resolveChangedFiles(root) : { files: [], diff: "" };

  if (changedOnly && files.length === 0) {
    return { step, status: "pass", duration: Date.now() - start, output: "No changed files to review." };
  }

  try {
    const output = await spawnWithStdin(llmCommand, ["--print"], buildLlmPrompt(prompt, files, diff), root);
    return { step, status: parseLlmVerdict(output) ? "pass" : "fail", duration: Date.now() - start, output };
  } catch (err) {
    return {
      step,
      status: "error",
      duration: Date.now() - start,
      output: err instanceof Error ? err.message : String(err),
      reason: "LLM command failed",
    };
  }
}

const BUILTIN_LLM_FALLBACKS: Record<string, ToolConfig> = {
  security: {
    name: "llm",
    prompt: `Review these changed files for security vulnerabilities. For each finding:
1. Describe the vulnerability
2. Tag it with the relevant OWASP Top 10 category (e.g., A01:2021-Broken Access Control) and CWE ID (e.g., CWE-89)
3. Rate severity: critical / high / medium / low

Check specifically for:
- SQL injection (CWE-89) — string concatenation in queries instead of parameterized queries
- XSS (CWE-79) — unescaped user input in HTML/template output
- Broken authentication (CWE-287) — custom token generation, weak session management, missing auth checks
- Insecure cryptography (CWE-327) — MD5/SHA1 for passwords, custom crypto, weak random
- SSRF (CWE-918) — user-controlled URLs in server-side requests
- Path traversal (CWE-22) — user input in file paths without sanitization
- Insecure deserialization (CWE-502) — pickle.loads, yaml.load without SafeLoader, eval()
- Missing access control (CWE-862) — endpoints without authorization checks
- CSRF (CWE-352) — state-changing endpoints without CSRF tokens
- Hardcoded secrets (CWE-798) — API keys, passwords, tokens in source code`,
  },
  dep_audit: {
    name: "llm",
    prompt: `Review these changed files for newly added dependencies or imports. For each finding:
1. Verify the package name is real and correctly spelled — flag potential typosquatting (e.g., 'reqeusts' instead of 'requests', 'lodash-utils' instead of 'lodash')
2. Flag packages you cannot verify as real published packages
3. Flag packages with known security advisories if you are aware of them
4. Tag supply chain risks with CWE-1357 (Reliance on Insufficiently Trustworthy Component)`,
  },
  secrets: {
    name: "llm",
    prompt: `Review these changed files for hardcoded secrets, API keys, passwords, tokens, private keys, or credentials.
Tag findings with CWE-798 (Use of Hard-coded Credentials) or CWE-312 (Cleartext Storage of Sensitive Information).
Flag any string that looks like a secret value rather than a placeholder or environment variable reference.
Check for: API keys, database connection strings, JWT secrets, private keys, OAuth client secrets, webhook URLs with tokens.`,
  },
  best_practices: {
    name: "llm",
    prompt: "Review these changed files for best practices violations",
  },
};

function getBuiltinLlmFallback(step: string): ToolConfig | undefined {
  return BUILTIN_LLM_FALLBACKS[step];
}

const MAX_FAIL_LINES = 30;

function printFailOutput(output: string): void {
  if (!output) return;
  const lines = output.split("\n");
  for (const line of lines.slice(0, MAX_FAIL_LINES)) {
    console.log(`    ${chalk.dim("→")} ${line}`);
  }
  if (lines.length > MAX_FAIL_LINES) {
    console.log(chalk.dim("    ... (truncated)"));
  }
}

function printStepResult(result: StepResult): void {
  const duration = `(${(result.duration / 1000).toFixed(1)}s)`;
  const stepName = result.step.padEnd(16);

  switch (result.status) {
    case "pass":
      console.log(
        `  ${stepName} ${chalk.green("✓ passed")}   ${chalk.dim(duration)}` +
          (result.reason ? `  ${chalk.dim(result.reason)}` : "")
      );
      break;
    case "fail":
      console.log(`  ${stepName} ${chalk.red("✗ failed")}   ${chalk.dim(duration)}`);
      printFailOutput(result.output);
      break;
    case "skip":
      console.log(
        `  ${stepName} ${chalk.dim("○ skipped")}  ${chalk.dim(result.reason ?? "")}`
      );
      break;
    case "error":
      console.log(
        `  ${stepName} ${chalk.yellow("! error")}    ${chalk.dim(result.reason ?? result.output)}`
      );
      break;
  }
}

async function runTestQualityStep(root: string): Promise<StepResult> {
  const start = Date.now();
  try {
    const filePaths = await fg(TEST_FILE_GLOBS, {
      cwd: root,
      absolute: true,
      ignore: TEST_FILE_IGNORE,
    });

    if (filePaths.length === 0) {
      return { step: "test_quality", status: "pass", duration: Date.now() - start, output: "No test files found." };
    }

    const report = await analyzeTestQuality(filePaths);
    const output = report.issues.length === 0
      ? `${report.functions} test functions analyzed — no issues found.`
      : report.issues.map(i => `${i.file}:${i.line} [${i.rule}] ${i.message}`).join("\n");

    return {
      step: "test_quality",
      status: report.summary.critical > 0 ? "fail" : "pass",
      duration: Date.now() - start,
      output,
    };
  } catch (err) {
    return {
      step: "test_quality",
      status: "error",
      duration: Date.now() - start,
      output: err instanceof Error ? err.message : String(err),
      reason: "test quality analysis failed",
    };
  }
}

async function runDocStyleStep(root: string, config: GrimoireConfig): Promise<StepResult> {
  const start = Date.now();
  const style = config.project.comment_style;

  if (!style) {
    return {
      step: "doc_style",
      status: "skip",
      duration: Date.now() - start,
      output: "",
      reason: "no comment_style configured",
    };
  }

  try {
    const report = await checkDocStyle(root, style, config.project.language);
    const output = report.issues.length === 0
      ? `${report.filesChecked} files checked — all match ${style} style.`
      : report.issues.map(i => `${i.file}:${i.line} ${i.message}`).join("\n");

    return {
      step: "doc_style",
      status: report.issues.some(i => i.severity === "critical") ? "fail" : "pass",
      duration: Date.now() - start,
      output,
    };
  } catch (err) {
    return {
      step: "doc_style",
      status: "error",
      duration: Date.now() - start,
      output: err instanceof Error ? err.message : String(err),
      reason: "doc style check failed",
    };
  }
}

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

async function runComplexityStep(root: string, config: GrimoireConfig): Promise<StepResult> {
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

