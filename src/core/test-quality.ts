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

/** Glob patterns for discovering test files. */
export const TEST_FILE_GLOBS = [
  "**/test_*.py",
  "**/*_test.py",
  "**/test_*.ts",
  "**/*.test.ts",
  "**/*.test.js",
  "**/*.spec.ts",
  "**/*.spec.js",
  "**/*_steps.py",
  "**/*.steps.ts",
  "**/*.steps.js",
  "**/steps/**/*.py",
  "**/step_definitions/**/*.ts",
  "**/step_definitions/**/*.js",
  "**/step_defs/**/*.py",
];

/** Directories to ignore when discovering test files. */
export const TEST_FILE_IGNORE = [
  "**/node_modules/**",
  "**/.venv/**",
  "**/dist/**",
];

/**
 * Analyze test files for quality issues.
 * Language-aware via file extension. Detects weak/missing assertions,
 * empty test bodies, tautological tests, and swallowed errors.
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

// --- Shared check helpers ---

interface WeakPattern {
  pattern: RegExp;
  msg: string;
}

const PYTHON_WEAK_PATTERNS: WeakPattern[] = [
  { pattern: /assert\s+True\b/, msg: "`assert True` is always true" },
  { pattern: /assert\s+not\s+None/, msg: "`assert not None` is trivially true for most return values" },
  { pattern: /assert\s+\w+\s+is\s+not\s+None/, msg: "Asserting `is not None` doesn't verify behavior — check the actual value" },
  { pattern: /assert\s+len\(\w+\)\s*>\s*0/, msg: "Asserting length > 0 doesn't verify the actual content" },
  { pattern: /assert\s+isinstance\(/, msg: "Type-only assertions don't verify behavior — check the actual value" },
];

const JS_WEAK_PATTERNS: WeakPattern[] = [
  { pattern: /expect\(.+\)\.toBeDefined\(\)/, msg: "`toBeDefined()` doesn't verify the actual value" },
  { pattern: /expect\(.+\)\.toBeTruthy\(\)/, msg: "`toBeTruthy()` is too broad — check the actual value" },
  { pattern: /expect\(.+\)\.not\.toBeNull\(\)/, msg: "`not.toBeNull()` doesn't verify the actual value" },
  { pattern: /expect\(true\)\.toBe\(true\)/, msg: "`expect(true).toBe(true)` is always true" },
  { pattern: /expect\(.+\.length\)\.toBeGreaterThan\(0\)/, msg: "Asserting length > 0 doesn't verify content" },
];

function checkWeakAssertions(
  body: string,
  fnName: string,
  file: string,
  line: number,
  lang: "python" | "js"
): TestIssue[] {
  const issues: TestIssue[] = [];
  const patterns = lang === "python" ? PYTHON_WEAK_PATTERNS : JS_WEAK_PATTERNS;
  const quote = lang === "python" ? "`" : '"';
  const suffix = lang === "python" ? "Strengthen with a specific expected value." : "Use a specific expected value.";

  for (const { pattern, msg } of patterns) {
    if (pattern.test(body)) {
      issues.push({
        file,
        line,
        severity: "warning",
        rule: "weak-assertion",
        message: `${quote}${fnName}${quote}: ${msg}. ${suffix}`,
      });
    }
  }

  return issues;
}

function checkPythonSwallowedErrors(
  body: string,
  fnName: string,
  file: string,
  line: number
): TestIssue[] {
  const exceptPattern = /except(?:\s+(?:Exception|BaseException|\w*Error))?(?:\s+as\s+\w+)?:/g;
  let exceptMatch;
  while ((exceptMatch = exceptPattern.exec(body)) !== null) {
    const rest = body.slice(exceptMatch.index + exceptMatch[0].length);
    const blockEnd = rest.search(/\n(?:except |else:|finally:)/);
    const block = blockEnd === -1 ? rest : rest.slice(0, blockEnd);
    if (!block.includes("raise") && !block.includes("assert") && !block.includes("pytest.raises")) {
      return [{
        file,
        line,
        severity: "critical",
        rule: "swallowed-error",
        message: `\`${fnName}\` has an except block that doesn't re-raise — this can silently swallow assertion errors.`,
      }];
    }
  }
  return [];
}

function checkJsSwallowedErrors(
  body: string,
  fnName: string,
  file: string,
  line: number
): TestIssue[] {
  const catchPattern = /catch\s*\([^)]*\)\s*\{/g;
  let catchMatch;
  while ((catchMatch = catchPattern.exec(body)) !== null) {
    let depth = 1;
    let pos = catchMatch.index + catchMatch[0].length;
    while (pos < body.length && depth > 0) {
      if (body[pos] === "{") depth++;
      if (body[pos] === "}") depth--;
      pos++;
    }
    const catchBody = body.slice(catchMatch.index + catchMatch[0].length, pos - 1);
    if (!catchBody.includes("throw") && !catchBody.includes("expect(") && !catchBody.includes("assert")) {
      return [{
        file,
        line,
        severity: "critical",
        rule: "swallowed-error",
        message: `"${fnName}" has a catch block that doesn't re-throw — this can silently swallow assertion errors.`,
      }];
    }
  }
  return [];
}

function checkPythonEmptyBody(
  body: string,
  fnName: string,
  file: string,
  line: number
): TestIssue | null {
  if (!body || body === "pass" || body === "..." || body === '"""..."""') {
    return {
      file,
      line,
      severity: "critical",
      rule: "empty-body",
      message: `Test function \`${fnName}\` has an empty body — it always passes and tests nothing.`,
    };
  }
  return null;
}

function checkPythonMissingAssertions(
  body: string,
  fnName: string,
  file: string,
  line: number
): TestIssue | null {
  const hasAssert =
    body.includes("assert ") ||
    body.includes("assert(") ||
    body.includes("assertEqual") ||
    body.includes("assertIn") ||
    body.includes("assertRaises") ||
    body.includes("pytest.raises") ||
    body.includes(".should") ||
    body.includes("expect(");

  if (!hasAssert && fnName !== "given" && fnName !== "when") {
    if (fnName === "then" || fnName.startsWith("test_")) {
      return {
        file,
        line,
        severity: "critical",
        rule: "no-assertion",
        message: `Test function \`${fnName}\` has no assertions — it will pass regardless of behavior.`,
      };
    } else if (fnName === "step_impl") {
      return {
        file,
        line,
        severity: "warning",
        rule: "no-assertion",
        message: `Step \`${fnName}\` has no assertions — verify it sets up state that a later Then step asserts.`,
      };
    }
  }
  return null;
}

function checkPythonTautological(
  body: string,
  fnName: string,
  file: string,
  line: number
): TestIssue | null {
  if (/assert\s+(\w+)\s*==\s*\1\b/.test(body)) {
    return {
      file,
      line,
      severity: "critical",
      rule: "tautological",
      message: `\`${fnName}\` asserts a value equals itself — this always passes.`,
    };
  }
  return null;
}

function analyzePythonFunction(
  fn: TestFunction,
  file: string,
  _lines: string[]
): TestIssue[] {
  const { body, name: fnName } = fn;
  const line = fn.startLine + 1;

  const emptyBody = checkPythonEmptyBody(body, fnName, file, line);
  if (emptyBody) return [emptyBody];

  const issues: TestIssue[] = [];

  const missingAssertion = checkPythonMissingAssertions(body, fnName, file, line);
  if (missingAssertion) issues.push(missingAssertion);

  issues.push(...checkWeakAssertions(body, fnName, file, line, "python"));

  const tautological = checkPythonTautological(body, fnName, file, line);
  if (tautological) issues.push(tautological);

  issues.push(...checkPythonSwallowedErrors(body, fnName, file, line));

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

function checkJsEmptyBody(
  body: string,
  fnName: string,
  file: string,
  line: number
): TestIssue | null {
  const stripped = body
    .replace(/(?:it|test)\s*\([^{]*\{/, "")
    .replace(/\}\s*\)\s*;?\s*$/, "")
    .trim();

  if (!stripped) {
    return {
      file,
      line,
      severity: "critical",
      rule: "empty-body",
      message: `Test "${fnName}" has an empty body — it always passes and tests nothing.`,
    };
  }
  return null;
}

function checkJsMissingAssertions(
  body: string,
  fnName: string,
  file: string,
  line: number
): TestIssue | null {
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
    return {
      file,
      line,
      severity: "critical",
      rule: "no-assertion",
      message: `Test "${fnName}" has no expect/assert calls — it will pass regardless of behavior.`,
    };
  }
  return null;
}

function analyzeJsFunction(
  fn: TestFunction,
  file: string,
  _lines: string[]
): TestIssue[] {
  const { body, name: fnName } = fn;
  const line = fn.startLine + 1;

  const emptyBody = checkJsEmptyBody(body, fnName, file, line);
  if (emptyBody) return [emptyBody];

  const issues: TestIssue[] = [];

  const missingAssertion = checkJsMissingAssertions(body, fnName, file, line);
  if (missingAssertion) issues.push(missingAssertion);

  issues.push(...checkWeakAssertions(body, fnName, file, line, "js"));
  issues.push(...checkJsSwallowedErrors(body, fnName, file, line));

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
