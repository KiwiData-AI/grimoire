import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { findProjectRoot } from "../utils/paths.js";
import { validateChange } from "./validate.js";
import { runCheck } from "./check.js";
import { analyzeTestQuality } from "./test-quality.js";
import { fileExists } from "../utils/fs.js";

interface CiOptions {
  annotations: boolean;
  skip?: string[];
  setup: boolean;
}

interface CiResult {
  validate: { errors: number; warnings: number };
  check: { passed: number; failed: number; errored: number };
  testQuality: { critical: number; warning: number };
  exitCode: number;
}

async function runValidatePhase(isGha: boolean): Promise<ReturnType<typeof validateChange>> {
  if (!isGha) console.log(chalk.bold("── Validate specs ──\n"));
  const result = await validateChange(undefined, { strict: false, json: isGha });
  if (isGha) {
    for (const r of result.results) {
      for (const err of r.errors) console.log(`::error file=${escapeGhaProp(r.file)}::${escapeGhaMsg(err)}`);
      for (const warn of r.warnings) console.log(`::warning file=${escapeGhaProp(r.file)}::${escapeGhaMsg(warn)}`);
    }
  }
  return result;
}

async function runChecksPhase(isGha: boolean, skip: string[] | undefined): Promise<ReturnType<typeof runCheck>> {
  if (!isGha) console.log(chalk.bold("\n── Run checks ──\n"));
  const result = await runCheck({ continueOnFail: true, changed: true, skip, json: isGha });
  if (isGha) {
    for (const r of result.results) {
      if (r.status === "fail") console.log(`::error title=${escapeGhaProp(r.step)}::${escapeGhaMsg(r.output.split("\n")[0])}`);
      else if (r.status === "error") console.log(`::error title=${escapeGhaProp(r.step)}::${escapeGhaMsg(r.reason ?? r.output)}`);
    }
  }
  return result;
}

async function runTestQualityPhase(isGha: boolean): Promise<{ critical: number; warning: number }> {
  if (!isGha) console.log(chalk.bold("\n── Test quality ──\n"));
  try {
    const root = await findProjectRoot();
    const glob = (await import("fast-glob")).default;
    const testFiles = await glob(
      ["**/*.test.ts", "**/*.test.js", "**/*.spec.ts", "**/*.spec.js", "**/test_*.py", "**/*_test.py"],
      { cwd: root, absolute: true, ignore: ["**/node_modules/**"] }
    );
    if (testFiles.length === 0) {
      if (!isGha) console.log(chalk.dim("  No test files found."));
      return { critical: 0, warning: 0 };
    }
    const report = await analyzeTestQuality(testFiles);
    if (isGha) {
      for (const issue of report.issues) {
        const level = issue.severity === "critical" ? "error" : "warning";
        console.log(`::${level} file=${escapeGhaProp(issue.file)},line=${issue.line}::${escapeGhaMsg(issue.message)}`);
      }
    } else {
      if (report.issues.length === 0) console.log(chalk.green("  No test quality issues found."));
      else console.log(`  ${report.summary.critical} critical, ${report.summary.warning} warnings`);
    }
    return { critical: report.summary.critical, warning: report.summary.warning };
  } catch {
    if (!isGha) console.log(chalk.dim("  Test quality analysis skipped."));
    return { critical: 0, warning: 0 };
  }
}

export async function runCi(options: CiOptions): Promise<CiResult> {
  if (options.setup) {
    await generateWorkflow();
    return { validate: { errors: 0, warnings: 0 }, check: { passed: 0, failed: 0, errored: 0 }, testQuality: { critical: 0, warning: 0 }, exitCode: 0 };
  }

  const isGha = options.annotations || !!process.env.GITHUB_ACTIONS;
  if (!isGha) console.log(chalk.bold("\ngrimoire ci\n"));

  const validateResult = await runValidatePhase(isGha);
  const checkResult = await runChecksPhase(isGha, options.skip);
  const tq = await runTestQualityPhase(isGha);

  const hasFailures = validateResult.errorCount > 0 || checkResult.failed > 0 || checkResult.errored > 0 || tq.critical > 0;
  const exitCode = hasFailures ? 1 : 0;

  if (!isGha) {
    console.log(chalk.bold("\n── Summary ──\n"));
    const icon = hasFailures ? chalk.red("✗") : chalk.green("✓");
    console.log(`  ${icon} Validate: ${validateResult.errorCount} errors, ${validateResult.warnCount} warnings`);
    console.log(`  ${icon} Checks: ${checkResult.passed} passed, ${checkResult.failed} failed`);
    console.log(`  ${icon} Test quality: ${tq.critical} critical, ${tq.warning} warnings`);
    console.log();
  }

  return {
    validate: { errors: validateResult.errorCount, warnings: validateResult.warnCount },
    check: { passed: checkResult.passed, failed: checkResult.failed, errored: checkResult.errored },
    testQuality: { critical: tq.critical, warning: tq.warning },
    exitCode,
  };
}

async function generateWorkflow(): Promise<void> {
  const root = await findProjectRoot();
  const workflowDir = join(root, ".github", "workflows");
  const workflowPath = join(workflowDir, "grimoire.yml");

  if (await fileExists(workflowPath)) {
    console.log(chalk.yellow("  .github/workflows/grimoire.yml already exists."));
    return;
  }

  await mkdir(workflowDir, { recursive: true });

  const workflow = `name: Grimoire CI

on:
  pull_request:
    paths:
      - 'features/**'
      - '.grimoire/**'
      - 'src/**'
      - 'tests/**'

jobs:
  grimoire:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Grimoire CI
        run: npx grimoire ci --annotations
`;

  await writeFile(workflowPath, workflow);
  console.log(chalk.green("  Created .github/workflows/grimoire.yml"));
}

/** Escape a value for GHA workflow command properties (file, title, etc.) */
function escapeGhaProp(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A").replace(/:/g, "%3A").replace(/,/g, "%2C");
}

/** Escape a value for GHA workflow command messages */
function escapeGhaMsg(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
