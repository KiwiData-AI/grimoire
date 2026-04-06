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

export async function runCi(options: CiOptions): Promise<CiResult> {
  if (options.setup) {
    await generateWorkflow();
    return { validate: { errors: 0, warnings: 0 }, check: { passed: 0, failed: 0, errored: 0 }, testQuality: { critical: 0, warning: 0 }, exitCode: 0 };
  }

  const isGha = options.annotations || !!process.env.GITHUB_ACTIONS;

  if (!isGha) {
    console.log(chalk.bold("\ngrimoire ci\n"));
  }

  // 1. Validate specs
  if (!isGha) {
    console.log(chalk.bold("── Validate specs ──\n"));
  }

  const validateResult = await validateChange(undefined, {
    strict: false,
    json: isGha,
  });

  if (isGha) {
    for (const r of validateResult.results) {
      for (const err of r.errors) {
        console.log(`::error file=${r.file}::${err}`);
      }
      for (const warn of r.warnings) {
        console.log(`::warning file=${r.file}::${warn}`);
      }
    }
  }

  // 2. Run checks (skip steps if requested)
  if (!isGha) {
    console.log(chalk.bold("\n── Run checks ──\n"));
  }

  const checkResult = await runCheck({
    continueOnFail: true,
    changed: true,
    skip: options.skip,
    json: isGha,
  });

  if (isGha) {
    for (const r of checkResult.results) {
      if (r.status === "fail") {
        console.log(`::error title=${r.step}::${r.output.split("\n")[0]}`);
      } else if (r.status === "error") {
        console.log(`::error title=${r.step}::${r.reason ?? r.output}`);
      }
    }
  }

  // 3. Test quality analysis
  if (!isGha) {
    console.log(chalk.bold("\n── Test quality ──\n"));
  }

  let testQualityCritical = 0;
  let testQualityWarning = 0;

  try {
    const root = await findProjectRoot();
    const glob = (await import("fast-glob")).default;
    const testFiles = await glob(
      ["**/*.test.ts", "**/*.test.js", "**/*.spec.ts", "**/*.spec.js", "**/test_*.py", "**/*_test.py"],
      { cwd: root, absolute: true, ignore: ["**/node_modules/**"] }
    );

    if (testFiles.length > 0) {
      const report = await analyzeTestQuality(testFiles);
      testQualityCritical = report.summary.critical;
      testQualityWarning = report.summary.warning;

      if (isGha) {
        for (const issue of report.issues) {
          const level = issue.severity === "critical" ? "error" : "warning";
          console.log(`::${level} file=${issue.file},line=${issue.line}::${issue.message}`);
        }
      } else {
        if (report.issues.length === 0) {
          console.log(chalk.green("  No test quality issues found."));
        } else {
          console.log(`  ${report.summary.critical} critical, ${report.summary.warning} warnings`);
        }
      }
    } else {
      if (!isGha) {
        console.log(chalk.dim("  No test files found."));
      }
    }
  } catch {
    if (!isGha) {
      console.log(chalk.dim("  Test quality analysis skipped."));
    }
  }

  // Summary
  const hasFailures =
    validateResult.errorCount > 0 ||
    checkResult.failed > 0 ||
    checkResult.errored > 0 ||
    testQualityCritical > 0;

  const exitCode = hasFailures ? 1 : 0;

  if (!isGha) {
    console.log(chalk.bold("\n── Summary ──\n"));
    const icon = hasFailures ? chalk.red("✗") : chalk.green("✓");
    console.log(`  ${icon} Validate: ${validateResult.errorCount} errors, ${validateResult.warnCount} warnings`);
    console.log(`  ${icon} Checks: ${checkResult.passed} passed, ${checkResult.failed} failed`);
    console.log(`  ${icon} Test quality: ${testQualityCritical} critical, ${testQualityWarning} warnings`);
    console.log();
  }

  return {
    validate: { errors: validateResult.errorCount, warnings: validateResult.warnCount },
    check: { passed: checkResult.passed, failed: checkResult.failed, errored: checkResult.errored },
    testQuality: { critical: testQualityCritical, warning: testQualityWarning },
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
