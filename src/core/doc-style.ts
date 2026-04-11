import { readFile } from "node:fs/promises";
import fg from "fast-glob";

export interface DocStyleIssue {
  file: string;
  line: number;
  severity: "critical" | "warning";
  message: string;
}

export interface DocStyleReport {
  filesChecked: number;
  issues: DocStyleIssue[];
}

/** Source file globs by language. */
const SOURCE_GLOBS: Record<string, string[]> = {
  python: ["**/*.py"],
  typescript: ["**/*.ts", "**/*.tsx"],
  javascript: ["**/*.js", "**/*.jsx"],
  go: ["**/*.go"],
  rust: ["**/*.rs"],
};

const SOURCE_IGNORE = [
  "**/node_modules/**",
  "**/.venv/**",
  "**/dist/**",
  "**/build/**",
  "**/__pycache__/**",
  "**/migrations/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/test_*",
  "**/*_test.*",
];

/**
 * Check that docstrings/comments in source files follow the configured style.
 * Supports: google, numpy, sphinx, pep257 (Python); jsdoc, tsdoc (JS/TS).
 */
export async function checkDocStyle(
  root: string,
  style: string,
  language?: string
): Promise<DocStyleReport> {
  const globs = resolveGlobs(style, language);
  const files = await fg(globs, { cwd: root, absolute: true, ignore: SOURCE_IGNORE });

  const issues: DocStyleIssue[] = [];

  // Sample up to 50 files to keep the check fast
  const sample = files.length > 50 ? files.slice(0, 50) : files;

  for (const filePath of sample) {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const isPython = filePath.endsWith(".py");
    const isJs = /\.[jt]sx?$/.test(filePath);

    if (isPython) {
      issues.push(...checkPythonDocStyle(filePath, lines, style));
    } else if (isJs) {
      issues.push(...checkJsDocStyle(filePath, lines, style));
    }
  }

  return { filesChecked: sample.length, issues };
}

function resolveGlobs(style: string, language?: string): string[] {
  if (["google", "numpy", "sphinx", "pep257"].includes(style)) {
    return SOURCE_GLOBS.python ?? ["**/*.py"];
  }
  if (["jsdoc", "tsdoc"].includes(style)) {
    return [...(SOURCE_GLOBS.typescript ?? []), ...(SOURCE_GLOBS.javascript ?? [])];
  }
  // Fallback: use language if known
  if (language && SOURCE_GLOBS[language]) {
    return SOURCE_GLOBS[language];
  }
  return ["**/*.py", "**/*.ts", "**/*.js"];
}

// --- Python docstring checks ---

function findDocstring(
  lines: string[],
  fnLine: number
): { line: number; content: string } | null {
  let docLine = fnLine + 1;
  while (docLine < lines.length && lines[docLine].trim() === "") docLine++;

  if (
    docLine >= lines.length ||
    (!lines[docLine].trim().startsWith('"""') && !lines[docLine].trim().startsWith("'''"))
  ) {
    return null;
  }

  return { line: docLine, content: extractPythonDocstring(lines, docLine) };
}

function checkPythonDocStyle(
  file: string,
  lines: string[],
  style: string
): DocStyleIssue[] {
  const issues: DocStyleIssue[] = [];
  const fnPattern = /^(\s*)def\s+(\w+)\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(fnPattern);
    if (!match) continue;

    const name = match[2];
    if (name.startsWith("_") && name !== "__init__") continue; // skip private

    const doc = findDocstring(lines, i);

    if (!doc) {
      if (!name.startsWith("test_")) {
        issues.push({
          file,
          line: i + 1,
          severity: "warning",
          message: `Function \`${name}\` is missing a docstring (expected ${style} style).`,
        });
      }
      continue;
    }

    for (const msg of validatePythonDocStyle(doc.content, style)) {
      issues.push({ file, line: doc.line + 1, severity: "warning", message: msg });
    }
  }

  return issues;
}

function extractPythonDocstring(lines: string[], start: number): string {
  const parts: string[] = [];
  const quote = lines[start].trim().startsWith('"""') ? '"""' : "'''";
  // Single-line docstring
  const firstLine = lines[start].trim();
  if (firstLine.indexOf(quote, 3) !== -1) {
    return firstLine;
  }
  for (let i = start; i < lines.length && i < start + 50; i++) {
    parts.push(lines[i]);
    if (i > start && lines[i].includes(quote)) break;
  }
  return parts.join("\n");
}

function validatePythonDocStyle(doc: string, style: string): string[] {
  const issues: string[] = [];
  const hasArgs = /\bArgs:\b/.test(doc);
  const hasParams = /:param\b/.test(doc);
  const hasParameters = /\bParameters\b/.test(doc);

  if (style === "google") {
    if (hasParams) issues.push("Uses `:param` (sphinx style) instead of `Args:` (google style).");
    if (hasParameters) issues.push("Uses `Parameters` (numpy style) instead of `Args:` (google style).");
  } else if (style === "numpy") {
    if (hasArgs) issues.push("Uses `Args:` (google style) instead of `Parameters` section (numpy style).");
    if (hasParams) issues.push("Uses `:param` (sphinx style) instead of `Parameters` section (numpy style).");
  } else if (style === "sphinx") {
    if (hasArgs) issues.push("Uses `Args:` (google style) instead of `:param` (sphinx style).");
    if (hasParameters) issues.push("Uses `Parameters` (numpy style) instead of `:param` (sphinx style).");
  }

  return issues;
}

// --- JS/TS doc comment checks ---

function findJsDoc(
  lines: string[],
  fnLine: number
): { line: number; content: string } | null {
  let commentEnd = fnLine - 1;
  while (commentEnd >= 0 && lines[commentEnd].trim() === "") commentEnd--;

  if (commentEnd < 0 || !lines[commentEnd].trim().endsWith("*/")) {
    return null;
  }

  return { line: commentEnd, content: extractJsDoc(lines, commentEnd) };
}

function checkJsDocStyle(
  file: string,
  lines: string[],
  style: string
): DocStyleIssue[] {
  const issues: DocStyleIssue[] = [];
  const fnPattern = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/;
  const methodPattern = /^\s+(?:async\s+)?(\w+)\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const fnMatch = lines[i].match(fnPattern) ?? lines[i].match(methodPattern);
    if (!fnMatch) continue;

    const name = fnMatch[1];
    if (name.startsWith("_")) continue;

    const doc = findJsDoc(lines, i);

    if (!doc) {
      if (!name.startsWith("test") && !name.startsWith("it") && !name.startsWith("describe")) {
        issues.push({
          file,
          line: i + 1,
          severity: "warning",
          message: `Function \`${name}\` is missing a ${style.toUpperCase()} comment.`,
        });
      }
      continue;
    }

    if (style === "tsdoc" && doc.content.includes("@param {")) {
      issues.push({
        file,
        line: doc.line + 1,
        severity: "warning",
        message: `\`${name}\` uses JSDoc \`@param {type}\` syntax instead of TSDoc (types belong in TypeScript signatures, not comments).`,
      });
    }
  }

  return issues;
}

function extractJsDoc(lines: string[], end: number): string {
  const parts: string[] = [];
  for (let i = end; i >= 0 && i > end - 30; i--) {
    parts.unshift(lines[i]);
    if (lines[i].trim().startsWith("/**")) break;
  }
  return parts.join("\n");
}
