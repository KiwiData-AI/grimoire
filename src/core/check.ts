import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import chalk from "chalk";
import { simpleGit } from "simple-git";
import fg from "fast-glob";
import { loadConfig, type GrimoireConfig } from "../utils/config.js";
import { findProjectRoot } from "../utils/paths.js";
import { spawnWithStdin } from "../utils/spawn.js";
import { analyzeTestQuality, TEST_FILE_GLOBS, TEST_FILE_IGNORE } from "./test-quality.js";
import { checkDocStyle } from "./doc-style.js";

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

export async function runCheck(options: CheckOptions): Promise<CheckResult> {
  const root = await findProjectRoot();
  const config = await loadConfig(root);

  // Determine which steps to run
  let steps = options.steps?.length ? options.steps : config.checks;
  if (options.skip?.length) {
    const skipSet = new Set(options.skip);
    steps = steps.filter((s) => !skipSet.has(s));
  }

  const results: StepResult[] = [];

  if (!options.json) {
    console.log(chalk.bold("\ngrimoire check\n"));
  }

  for (const step of steps) {
    const result = await runStep(step, root, config, options);
    results.push(result);
    if (!options.json) printStepResult(result);
    if (result.status === "fail" && !options.continueOnFail) break;
  }

  // Summary
  const passed = results.filter((r) => r.status === "pass").length;
  const failedCount = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const errored = results.filter((r) => r.status === "error").length;

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          results,
          summary: { passed, failed: failedCount, skipped, errored },
        },
        null,
        2
      )
    );
  } else {
    console.log(
      `\n  ${chalk.green(`${passed} passed`)}, ${failedCount > 0 ? chalk.red(`${failedCount} failed`) : `${failedCount} failed`}, ${skipped} skipped${errored > 0 ? `, ${errored} errored` : ""}\n`
    );
  }

  return { results, passed, failed: failedCount, skipped, errored };
}

async function runStep(
  step: string,
  root: string,
  config: GrimoireConfig,
  options: CheckOptions,
): Promise<StepResult> {
  if (step === "test_quality") return runTestQualityStep(root);
  if (step === "doc_style") return runDocStyleStep(root, config);

  // Complexity: use built-in auto-detect unless an explicit tool is configured
  if (step === "complexity" && !config.tools[step]?.command && !config.tools[step]?.check_command) {
    return runComplexityStep(root, config);
  }

  const tool = config.tools[step];

  if (!tool || (!tool.command && !tool.check_command && tool.name !== "llm")) {
    return { step, status: "skip", duration: 0, output: "", reason: "not configured" };
  }

  if (tool.name === "llm") {
    return runLlmStep(step, tool.prompt ?? "", config.llm.coding.command, root, options.changed);
  }

  const command = tool.check_command ?? tool.command!;
  return runShellStep(step, command, root);
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
      return {
        step,
        status: "fail",
        duration,
        output: (execErr.stdout + execErr.stderr).trim(),
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

async function runLlmStep(
  step: string,
  prompt: string,
  llmCommand: string,
  root: string,
  changedOnly: boolean
): Promise<StepResult> {
  const start = Date.now();

  // Check if LLM command is available
  try {
    await execFileAsync("which", [llmCommand]);
  } catch {
    return {
      step,
      status: "skip",
      duration: Date.now() - start,
      output: "",
      reason: `${llmCommand} not found`,
    };
  }

  // Get changed files
  let files: string[] = [];
  if (changedOnly) {
    try {
      const git = simpleGit(root);
      const diffOutput = await git.diff(["--name-only", "HEAD"]);
      files = diffOutput.trim().split("\n").filter(Boolean);
      if (files.length === 0) {
        // Try staged files
        const staged = await git.diff(["--name-only", "--cached"]);
        files = staged.trim().split("\n").filter(Boolean);
      }
    } catch {
      // Not a git repo or no changes
    }
  }

  if (changedOnly && files.length === 0) {
    return {
      step,
      status: "pass",
      duration: Date.now() - start,
      output: "No changed files to review.",
    };
  }

  const fileList = files.length > 0 ? `\n\nFiles to review:\n${files.join("\n")}` : "";
  const fullPrompt = `${prompt}${fileList}\n\nRespond with PASS if no issues found, or FAIL followed by the issues.`;

  const tmpFile = join(tmpdir(), `grimoire-prompt-${randomUUID()}.txt`);
  try {
    await writeFile(tmpFile, fullPrompt);

    const output = await spawnWithStdin(llmCommand, ["--print"], fullPrompt, root);

    const passed = output.toUpperCase().startsWith("PASS");

    return {
      step,
      status: passed ? "pass" : "fail",
      duration: Date.now() - start,
      output,
    };
  } catch (err) {
    return {
      step,
      status: "error",
      duration: Date.now() - start,
      output: err instanceof Error ? err.message : String(err),
      reason: "LLM command failed",
    };
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

function printStepResult(result: StepResult): void {
  const duration = `(${(result.duration / 1000).toFixed(1)}s)`;
  const stepName = result.step.padEnd(16);

  switch (result.status) {
    case "pass":
      console.log(
        `  ${stepName} ${chalk.green("✓ passed")}   ${chalk.dim(duration)}`
      );
      break;
    case "fail":
      console.log(
        `  ${stepName} ${chalk.red("✗ failed")}   ${chalk.dim(duration)}`
      );
      if (result.output) {
        const lines = result.output.split("\n").slice(0, 5);
        for (const line of lines) {
          console.log(`    ${chalk.dim("→")} ${line}`);
        }
        if (result.output.split("\n").length > 5) {
          console.log(chalk.dim("    ... (truncated)"));
        }
      }
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
      "npx eslint --no-eslintrc --rule 'complexity: [warn, 10]' --ext .ts,.tsx,.js,.jsx src/ 2>&1 || true",
    ], { cwd: root, timeout: 60_000 });
    const output = (stdout + stderr).trim();
    const hasWarnings = output.includes("warning") || output.includes("error");
    return { output, hasWarnings };
  } catch {
    return null;
  }
}

async function runComplexityStep(root: string, config: GrimoireConfig): Promise<StepResult> {
  const start = Date.now();
  const lang = config.project.language;

  if (!lang || lang === "python") {
    const radon = await tryRadon(root);
    if (radon) {
      return {
        step: "complexity",
        status: radon.hasHighComplexity ? "fail" : "pass",
        duration: Date.now() - start,
        output: radon.output || "No high-complexity functions found.",
      };
    }
  }

  if (!lang || ["typescript", "javascript"].includes(lang ?? "")) {
    const eslint = await tryEslintComplexity(root);
    if (eslint) {
      return {
        step: "complexity",
        status: eslint.hasWarnings ? "fail" : "pass",
        duration: Date.now() - start,
        output: eslint.output || "No high-complexity functions found.",
      };
    }
  }

  return {
    step: "complexity",
    status: "skip",
    duration: Date.now() - start,
    output: "",
    reason: "no complexity tool found (install radon for Python or eslint for JS/TS)",
  };
}

