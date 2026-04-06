import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import chalk from "chalk";

export interface TestIssue {
  file: string;
  line: number;
  severity: "critical" | "warning" | "suggestion";
  rule: string;
  message: string;
  code?: string;
}

export interface TestQualityReport {
  files: number;
  functions: number;
  issues: TestIssue[];
  summary: {
    critical: number;
    warning: number;
    suggestion: number;
  };
}

/**
 * Analyze test files for quality issues.
 * Language-aware via file extension. Detects weak/missing assertions,
 * empty test bodies, and tautological tests.
 */
export async function analyzeTestQuality(
  filePaths: string[]
): Promise<TestQualityReport> {
  const issues: TestIssue[] = [];
  let totalFunctions = 0;

  for (const filePath of filePaths) {
    const content = await readFile(filePath, "utf-8");
    const ext = extname(filePath);
    const lines = content.split("\n");

    const lang =
      ext === ".py"
        ? "python"
        : [".ts", ".tsx", ".js", ".jsx"].includes(ext)
          ? "javascript"
          : null;

    if (!lang) continue;

    const functions =
      lang === "python"
        ? extractPythonTestFunctions(lines)
        : extractJsTestFunctions(lines);

    totalFunctions += functions.length;

    for (const fn of functions) {
      const fnIssues =
        lang === "python"
          ? analyzePythonFunction(fn, filePath, lines)
          : analyzeJsFunction(fn, filePath, lines);
      issues.push(...fnIssues);
    }
  }

  return {
    files: filePaths.length,
    functions: totalFunctions,
    issues,
    summary: {
      critical: issues.filter((i) => i.severity === "critical").length,
      warning: issues.filter((i) => i.severity === "warning").length,
      suggestion: issues.filter((i) => i.severity === "suggestion").length,
    },
  };
}

interface TestFunction {
  name: string;
  startLine: number;
  endLine: number;
  body: string;
}

// --- Python analysis ---

function extractPythonTestFunctions(lines: string[]): TestFunction[] {
  const functions: TestFunction[] = [];
  const fnPattern = /^(\s*)def\s+(test_\w+|step_impl|given|when|then)\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(fnPattern);
    if (!match) continue;

    const indent = match[1].length;
    const name = match[2];
    const startLine = i;

    // Find end of function (next line at same or lower indent, or EOF)
    let endLine = i + 1;
    while (endLine < lines.length) {
      const line = lines[endLine];
      if (
        line.trim() !== "" &&
        !line.startsWith(" ".repeat(indent + 1)) &&
        !line.startsWith("\t".repeat(Math.floor(indent / 4) + 1))
      ) {
        // Check if it's a decorator or new function at same level
        if (!line.match(/^\s*@/) && line.trim().length > 0) {
          break;
        }
      }
      endLine++;
    }

    const body = lines
      .slice(startLine + 1, endLine)
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("#"))
      .join("\n");

    functions.push({ name, startLine, endLine, body });
  }

  return functions;
}

function analyzePythonFunction(
  fn: TestFunction,
  file: string,
  _lines: string[]
): TestIssue[] {
  const issues: TestIssue[] = [];
  const body = fn.body;

  // Empty body
  if (!body || body === "pass" || body === "..." || body === '"""..."""') {
    issues.push({
      file,
      line: fn.startLine + 1,
      severity: "critical",
      rule: "empty-body",
      message: `Test function \`${fn.name}\` has an empty body — it always passes and tests nothing.`,
    });
    return issues;
  }

  // No assertions
  const hasAssert =
    body.includes("assert ") ||
    body.includes("assert(") ||
    body.includes("assertEqual") ||
    body.includes("assertIn") ||
    body.includes("assertRaises") ||
    body.includes("pytest.raises") ||
    body.includes(".should") ||
    body.includes("expect(");

  if (!hasAssert && fn.name !== "given" && fn.name !== "when") {
    // Given/When steps may legitimately set up state without asserting
    if (fn.name === "then" || fn.name.startsWith("test_")) {
      issues.push({
        file,
        line: fn.startLine + 1,
        severity: "critical",
        rule: "no-assertion",
        message: `Test function \`${fn.name}\` has no assertions — it will pass regardless of behavior.`,
      });
    } else if (fn.name === "step_impl") {
      issues.push({
        file,
        line: fn.startLine + 1,
        severity: "warning",
        rule: "no-assertion",
        message: `Step \`${fn.name}\` has no assertions — verify it sets up state that a later Then step asserts.`,
      });
    }
  }

  // Weak assertions
  const weakPatterns = [
    { pattern: /assert\s+True\b/, msg: "`assert True` is always true" },
    { pattern: /assert\s+not\s+None/, msg: "`assert not None` is trivially true for most return values" },
    { pattern: /assert\s+\w+\s+is\s+not\s+None/, msg: "Asserting `is not None` doesn't verify behavior — check the actual value" },
    { pattern: /assert\s+len\(\w+\)\s*>\s*0/, msg: "Asserting length > 0 doesn't verify the actual content" },
    { pattern: /assert\s+isinstance\(/, msg: "Type-only assertions don't verify behavior — check the actual value" },
  ];

  for (const { pattern, msg } of weakPatterns) {
    if (pattern.test(body)) {
      issues.push({
        file,
        line: fn.startLine + 1,
        severity: "warning",
        rule: "weak-assertion",
        message: `\`${fn.name}\`: ${msg}. Strengthen with a specific expected value.`,
      });
    }
  }

  // Tautological: asserting against self
  if (/assert\s+(\w+)\s*==\s*\1\b/.test(body)) {
    issues.push({
      file,
      line: fn.startLine + 1,
      severity: "critical",
      rule: "tautological",
      message: `\`${fn.name}\` asserts a value equals itself — this always passes.`,
    });
  }

  return issues;
}

// --- JavaScript/TypeScript analysis ---

function extractJsTestFunctions(lines: string[]): TestFunction[] {
  const functions: TestFunction[] = [];
  const fnPattern = /(?:it|test)\s*\(\s*['"`](.+?)['"`]/;

  let braceDepth = 0;
  let inTest = false;
  let currentName = "";
  let startLine = 0;
  let bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inTest) {
      const match = line.match(fnPattern);
      if (match) {
        inTest = true;
        currentName = match[1];
        startLine = i;
        braceDepth = 0;
        bodyLines = [];
      }
    }

    if (inTest) {
      // Count braces (rough — doesn't handle strings/comments perfectly)
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }
      bodyLines.push(line);

      if (braceDepth <= 0 && bodyLines.length > 1) {
        const body = bodyLines
          .map((l) => l.trim())
          .filter((l) => l !== "" && !l.startsWith("//"))
          .join("\n");
        functions.push({
          name: currentName,
          startLine,
          endLine: i,
          body,
        });
        inTest = false;
      }
    }
  }

  return functions;
}

function analyzeJsFunction(
  fn: TestFunction,
  file: string,
  _lines: string[]
): TestIssue[] {
  const issues: TestIssue[] = [];
  const body = fn.body;

  // Empty body (just the it/test wrapper with no real content)
  const stripped = body
    .replace(/(?:it|test)\s*\([^{]*\{/, "")
    .replace(/\}\s*\)\s*;?\s*$/, "")
    .trim();

  if (!stripped) {
    issues.push({
      file,
      line: fn.startLine + 1,
      severity: "critical",
      rule: "empty-body",
      message: `Test "${fn.name}" has an empty body — it always passes and tests nothing.`,
    });
    return issues;
  }

  // No assertions
  const hasExpect =
    body.includes("expect(") ||
    body.includes("assert(") ||
    body.includes("assert.") ||
    body.includes(".should") ||
    body.includes(".to.") ||
    body.includes("toEqual") ||
    body.includes("toBe") ||
    body.includes("toThrow");

  if (!hasExpect) {
    issues.push({
      file,
      line: fn.startLine + 1,
      severity: "critical",
      rule: "no-assertion",
      message: `Test "${fn.name}" has no expect/assert calls — it will pass regardless of behavior.`,
    });
  }

  // Weak assertions
  const weakPatterns = [
    { pattern: /expect\(.+\)\.toBeDefined\(\)/, msg: "`toBeDefined()` doesn't verify the actual value" },
    { pattern: /expect\(.+\)\.toBeTruthy\(\)/, msg: "`toBeTruthy()` is too broad — check the actual value" },
    { pattern: /expect\(.+\)\.not\.toBeNull\(\)/, msg: "`not.toBeNull()` doesn't verify the actual value" },
    { pattern: /expect\(true\)\.toBe\(true\)/, msg: "`expect(true).toBe(true)` is always true" },
    { pattern: /expect\(.+\.length\)\.toBeGreaterThan\(0\)/, msg: "Asserting length > 0 doesn't verify content" },
  ];

  for (const { pattern, msg } of weakPatterns) {
    if (pattern.test(body)) {
      issues.push({
        file,
        line: fn.startLine + 1,
        severity: "warning",
        rule: "weak-assertion",
        message: `"${fn.name}": ${msg}. Use a specific expected value.`,
      });
    }
  }

  return issues;
}

/**
 * Print a test quality report to the console.
 */
export function printReport(report: TestQualityReport): void {
  if (report.issues.length === 0) {
    console.log(
      chalk.green(`\n  ${report.functions} test functions analyzed — no issues found.\n`)
    );
    return;
  }

  console.log(chalk.bold("\nTest Quality Report\n"));

  const grouped = new Map<string, TestIssue[]>();
  for (const issue of report.issues) {
    const key = issue.file;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(issue);
  }

  for (const [file, fileIssues] of grouped) {
    console.log(chalk.bold(`  ${file}`));
    for (const issue of fileIssues) {
      const icon =
        issue.severity === "critical"
          ? chalk.red("✗")
          : issue.severity === "warning"
            ? chalk.yellow("!")
            : chalk.dim("○");
      console.log(`    ${icon} ${chalk.dim(`L${issue.line}`)} [${issue.rule}] ${issue.message}`);
    }
    console.log();
  }

  console.log(
    `  ${chalk.red(`${report.summary.critical} critical`)}, ${chalk.yellow(`${report.summary.warning} warnings`)}, ${report.summary.suggestion} suggestions\n`
  );
}
