import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import fg from "fast-glob";
import { loadConfig, type GrimoireConfig, type ToolConfig } from "../utils/config.js";
import { findProjectRoot } from "../utils/paths.js";
import { analyzeTestQuality, TEST_FILE_GLOBS, TEST_FILE_IGNORE } from "./test-quality.js";
import { checkDocStyle } from "./doc-style.js";
import { loadAcceptedRiskIds, partitionAdvisories } from "./risk-register.js";
import { runComplexityStep } from "./check-complexity.js";
import { runLlmStep, getBuiltinLlmFallback } from "./check-llm.js";

// Steps whose scanner prints CVE/GHSA ids, so the risk-acceptance register can
// suppress them. No-op for tools that don't key failures by advisory id.
const REGISTER_AWARE_STEPS = new Set(["dep_audit", "security"]);

const execFileAsync = promisify(execFile);

export interface CheckOptions {
  steps?: string[];
  continueOnFail: boolean;
  changed: boolean;
  skip?: string[];
  json: boolean;
}

export interface StepResult {
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

// Pass a failed vuln scan only if every advisory it printed is unexpired-accepted;
// otherwise still fail, annotating which were suppressed vs. outstanding.
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
