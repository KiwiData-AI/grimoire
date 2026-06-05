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
    // Self-containment applies under any comment_style.
    issues.push(...checkVolatileRefs(filePath, lines));
  }

  return { filesChecked: sample.length, issues };
}

// --- Self-containment: comments must not name external, volatile artifacts ---
// (ADR/MADR ids, .feature files, tag codes, change-ids, issue/PR refs, test files).
// These orphan when the artifact moves. Generic words (test, feature, scenario)
// used descriptively are fine — we match identifiers, not vocabulary.
const VOLATILE_RE =
  /\b(?:ADR|MADR)[-\s]?\d+|\b\d{4}-[a-z][a-z0-9-]{2,}\b|\b[A-Z]{2,}-[A-Z]{2,}-\d+\b|[\w./-]+\.feature\b|\bissues?\s*#?\d+\b|\bPR\s*#\d+\b|[\w-]+\.(?:test|spec)\.[jt]sx?\b/;

function commentTextOf(line: string): string | null {
  const t = line.trim();
  if (
    t.startsWith("#") ||
    t.startsWith("//") ||
    t.startsWith("*") ||
    t.startsWith('"""') ||
    t.startsWith("'''") ||
    t.startsWith("/*")
  ) {
    return t;
  }
  const hash = line.indexOf("# ");
  if (hash !== -1) return line.slice(hash);
  const slash = line.indexOf("// ");
  if (slash !== -1) return line.slice(slash);
  return null;
}

function checkVolatileRefs(file: string, lines: string[]): DocStyleIssue[] {
  const issues: DocStyleIssue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const text = commentTextOf(lines[i]);
    if (!text) continue;
    const m = text.match(VOLATILE_RE);
    if (m) {
      issues.push({
        file,
        line: i + 1,
        severity: "warning",
        message: `Comment references an external artifact (\`${m[0]}\`) — make it self-contained; that reference orphans when the artifact moves.`,
      });
    }
  }
  return issues;
}

// --- No essays: summary prose before the params section stays to ~2 lines ---
const PY_PARAM_RE = /^\s*(?:Args:|Arguments:|Parameters|:param\b|:returns?:|:rtype:|Returns:|Raises:|Yields:)/;
const JS_PARAM_RE = /@(?:param|returns?|throws|yields)\b/;

function proseLineCount(doc: string, paramRe: RegExp): number {
  let prose = 0;
  for (const raw of doc.split("\n")) {
    const t = raw.replace(/^[\s*]*/, "").replace(/(\/\*\*|\*\/|"""|''')/g, "").trim();
    if (paramRe.test(raw)) break;
    if (t) prose++;
  }
  return prose;
}

function essayIssue(file: string, line: number, doc: string, paramRe: RegExp): DocStyleIssue | null {
  if (proseLineCount(doc, paramRe) > 2) {
    return {
      file,
      line,
      severity: "warning",
      message: "Docstring leads with a prose paragraph — keep the summary to 1–2 terse lines before any params; move design rationale to a decision record.",
    };
  }
  return null;
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
    const essay = essayIssue(file, doc.line + 1, doc.content, PY_PARAM_RE);
    if (essay) issues.push(essay);
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

function isTestFunctionName(name: string): boolean {
  return name.startsWith("test") || name.startsWith("it") || name.startsWith("describe");
}

function getDocStyleIssue(
  file: string,
  name: string,
  lineNum: number,
  style: string,
  doc: ReturnType<typeof findJsDoc>
): DocStyleIssue | null {
  if (!doc) {
    if (!isTestFunctionName(name)) {
      return {
        file,
        line: lineNum,
        severity: "warning",
        message: `Function \`${name}\` is missing a ${style.toUpperCase()} comment.`,
      };
    }
    return null;
  }
  if (style === "tsdoc" && doc.content.includes("@param {")) {
    return {
      file,
      line: doc.line + 1,
      severity: "warning",
      message: `\`${name}\` uses JSDoc \`@param {type}\` syntax instead of TSDoc (types belong in TypeScript signatures, not comments).`,
    };
  }
  return null;
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
    const issue = getDocStyleIssue(file, name, i + 1, style, doc);
    if (issue) issues.push(issue);
    if (doc) {
      const essay = essayIssue(file, doc.line + 1, doc.content, JS_PARAM_RE);
      if (essay) issues.push(essay);
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
