import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import chalk from "chalk";
import { loadConfig } from "../utils/config.js";
import { findProjectRoot } from "../utils/paths.js";

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
  let stopped = false;

  if (!options.json) {
    console.log(chalk.bold("\ngrimoire check\n"));
  }

  for (const step of steps) {
    const tool = config.tools[step];

    if (!tool || (!tool.command && !tool.check_command && tool.name !== "llm")) {
      const result: StepResult = {
        step,
        status: "skip",
        duration: 0,
        output: "",
        reason: "not configured",
      };
      results.push(result);
      if (!options.json) {
        printStepResult(result);
      }
      continue;
    }

    // LLM steps
    if (tool.name === "llm") {
      const result = await runLlmStep(step, tool.prompt ?? "", config.llm.coding.command, root, options.changed);
      results.push(result);
      if (!options.json) {
        printStepResult(result);
      }
      if (result.status === "fail" && !options.continueOnFail) {
        stopped = true;
        break;
      }
      continue;
    }

    // Regular tool steps
    const command = tool.check_command ?? tool.command!;
    const result = await runShellStep(step, command, root);
    results.push(result);

    if (!options.json) {
      printStepResult(result);
    }

    if (result.status === "fail" && !options.continueOnFail) {
      stopped = true;
      break;
    }
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
      const { stdout } = await execFileAsync(
        "git",
        ["diff", "--name-only", "HEAD"],
        { cwd: root }
      );
      files = stdout.trim().split("\n").filter(Boolean);
      if (files.length === 0) {
        // Try staged files
        const { stdout: staged } = await execFileAsync(
          "git",
          ["diff", "--name-only", "--cached"],
          { cwd: root }
        );
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

/**
 * Spawn a command with stdin piped, avoiding sh -c shell interpretation.
 */
function spawnWithStdin(
  command: string,
  args: string[],
  input: string,
  cwd: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parts = command.split(/\s+/);
    const proc = spawn(parts[0], [...parts.slice(1), ...args], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120_000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0 || stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `Command exited with code ${code}`));
      }
    });

    proc.stdin.write(input);
    proc.stdin.end();
  });
}
