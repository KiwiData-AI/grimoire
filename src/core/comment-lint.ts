import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { VOLATILE_RE } from "./doc-style.js";
import { loadConfig, type CommentLintMode } from "../utils/config.js";
import { findProjectRoot } from "../utils/paths.js";
import { readStdin } from "../utils/stdin.js";

export type { CommentLintMode };

export interface CommentLintIssue {
  line: number;
  rule: "verbose_comment" | "external_ref" | "placeholder_stub";
  message: string;
}

const PRAGMA = "grimoire-lint-ok";

// A run of line comments longer than this reads as an essay. Matches the
// 2-line prose budget the doc_style check applies to docstrings.
const MAX_COMMENT_RUN = 2;

// Line-comment token by language. Block doc comments (/** */, """) are owned by
// the doc_style check, so they are deliberately not treated as line comments here.
const HASH_EXTS = new Set([".py"]);
const SLASH_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".go", ".rs"]);

// Matched against comment TEXT only (not raw code), so code like `{ ...rest }`
// or `throw new Error("not implemented")` is never flagged — only comments are.
const PLACEHOLDER_RE =
  /\.\.\.\s*(?:existing|rest|more|other|unchanged)|(?:rest|remainder|remaining)\s+of\s+(?:the\s+)?(?:code|file|method|function|class|implementation)|existing\s+code|your\s+code\s+here|(?:code|implementation)\s+(?:goes\s+)?here|not\s+implemented|unimplemented|todo:?\s*implement|fill\s+(?:this\s+)?in/i;

export function isSourceFile(path: string): boolean {
  const ext = extname(path).toLowerCase();
  return HASH_EXTS.has(ext) || SLASH_EXTS.has(ext);
}

function lineToken(path: string): "#" | "//" {
  return HASH_EXTS.has(extname(path).toLowerCase()) ? "#" : "//";
}

/** The comment text of a line for the given token, or null if it isn't a comment. */
function commentOf(line: string, token: "#" | "//"): string | null {
  const t = line.trim();
  if (token === "#") {
    if (t.startsWith("#") && !t.startsWith("#!")) return t;
    const i = line.indexOf("# ");
    return i !== -1 ? line.slice(i) : null;
  }
  if (t.startsWith("//")) return t;
  const i = line.indexOf("// ");
  return i !== -1 ? line.slice(i) : null;
}

function isLineComment(line: string, token: "#" | "//"): boolean {
  const t = line.trim();
  return token === "#" ? t.startsWith("#") && !t.startsWith("#!") : t.startsWith("//");
}

function isEllipsisOnly(line: string, token: "#" | "//"): boolean {
  const t = line.trim();
  return t === "..." || t === `${token} ...` || t === `${token}...`;
}

// A run of consecutive line comments longer than the terse limit reads as an essay.
function findVerboseRuns(lines: string[], token: "#" | "//"): CommentLintIssue[] {
  const issues: CommentLintIssue[] = [];
  let start = -1;
  let len = 0;
  let pragma = false;
  const flush = (): void => {
    if (len > MAX_COMMENT_RUN && !pragma) {
      issues.push({
        line: start + 1,
        rule: "verbose_comment",
        message: `Comment block spans ${len} lines — keep it to ${MAX_COMMENT_RUN}; drop lines that restate the code or move rationale to a decision record.`,
      });
    }
    start = -1;
    len = 0;
    pragma = false;
  };
  for (let i = 0; i < lines.length; i++) {
    if (!isLineComment(lines[i], token)) {
      flush();
      continue;
    }
    if (len === 0) start = i;
    len++;
    if (lines[i].includes(PRAGMA)) pragma = true;
  }
  flush();
  return issues;
}

function inlineIssue(line: string, index: number, token: "#" | "//"): CommentLintIssue | null {
  const comment = commentOf(line, token);
  if (!comment) return null;
  const m = comment.match(VOLATILE_RE);
  if (m) {
    return {
      line: index + 1,
      rule: "external_ref",
      message: `Comment references an external artifact (\`${m[0]}\`) — make it self-contained; that reference orphans when the artifact moves.`,
    };
  }
  if (PLACEHOLDER_RE.test(comment) || isEllipsisOnly(line, token)) {
    return {
      line: index + 1,
      rule: "placeholder_stub",
      message: `Placeholder/stub marker — finish the edit or remove the marker (add \`${PRAGMA}\` if it is intentional).`,
    };
  }
  return null;
}

/** Lint the comments in a block of source text. Line numbers are 1-based within `text`. */
export function lintComments(text: string, filePath: string): CommentLintIssue[] {
  const token = lineToken(filePath);
  const lines = text.split("\n");
  const issues = findVerboseRuns(lines, token);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(PRAGMA)) continue;
    const issue = inlineIssue(lines[i], i, token);
    if (issue) issues.push(issue);
  }
  return issues.sort((a, b) => a.line - b.line);
}

interface EditOp {
  new_string?: string;
}

interface PreToolUsePayload {
  tool_name?: string;
  tool_input?: { file_path?: string; new_string?: string; content?: string; edits?: EditOp[] };
  cwd?: string;
}

const EDIT_TOOLS = new Set(["Edit", "MultiEdit", "Write"]);

/** 1-based line numbers in `proposed` that are not already present in `current`. */
export function addedLineNumbers(current: string, proposed: string): Set<number> {
  const remaining = new Map<string, number>();
  for (const raw of current.split("\n")) {
    const k = raw.trim();
    remaining.set(k, (remaining.get(k) ?? 0) + 1);
  }
  const added = new Set<number>();
  const lines = proposed.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const k = lines[i].trim();
    const have = remaining.get(k) ?? 0;
    if (have > 0) remaining.set(k, have - 1);
    else added.add(i + 1);
  }
  return added;
}

interface Changed {
  text: string;
  // Present for Write: 1-based file line numbers that are new vs disk. Absent for
  // Edit/MultiEdit, whose line numbers are offsets within the inserted text.
  added?: Set<number>;
  relative: boolean;
}

async function changedPortion(payload: PreToolUsePayload, cwd: string): Promise<Changed | null> {
  const input = payload.tool_input;
  if (!input?.file_path) return null;

  if (payload.tool_name === "Edit") {
    return input.new_string != null ? { text: input.new_string, relative: true } : null;
  }
  if (payload.tool_name === "MultiEdit") {
    const text = (input.edits ?? []).map((e) => e.new_string ?? "").join("\n");
    return text ? { text, relative: true } : null;
  }
  // Write replaces the whole file — lint only lines new relative to what is on disk.
  if (input.content == null) return null;
  let current = "";
  try {
    current = await readFile(resolve(cwd, input.file_path), "utf-8");
  } catch {
    current = "";
  }
  return { text: input.content, added: addedLineNumbers(current, input.content), relative: false };
}

function formatIssues(
  file: string,
  issues: CommentLintIssue[],
  mode: CommentLintMode,
  relative: boolean
): string {
  const head =
    mode === "block"
      ? `[grimoire-comment-lint] Blocked write to ${file} — ${issues.length} comment issue(s):`
      : `[grimoire-comment-lint] ${file} — ${issues.length} comment issue(s):`;
  // Edit/MultiEdit line numbers are offsets within the inserted text, not file lines.
  const loc = (n: number): string => (relative ? `inserted line ${n}` : `L${n}`);
  const body = issues.map((i) => `  ${loc(i.line)} ${i.rule}: ${i.message}`);
  const tail =
    mode === "block"
      ? ["", "Write terser comments and retry, or add `grimoire-lint-ok` to a comment that is genuinely needed."]
      : [];
  return [head, ...body, ...tail].join("\n");
}

async function resolveMode(override: string | undefined, cwd: string): Promise<CommentLintMode> {
  if (override === "block" || override === "warn" || override === "off") return override;
  const config = await loadConfig(await findProjectRoot(cwd));
  return config.project.comment_lint ?? "off";
}

/** Parse and gate the stdin payload. Returns null for any case the hook ignores. */
function parsePayload(raw: string): PreToolUsePayload | null {
  if (!raw.trim()) return null;
  let payload: PreToolUsePayload;
  try {
    payload = JSON.parse(raw) as PreToolUsePayload;
  } catch {
    return null;
  }
  if (!payload.tool_name || !EDIT_TOOLS.has(payload.tool_name)) return null;
  const filePath = payload.tool_input?.file_path;
  if (!filePath || !isSourceFile(filePath)) return null;
  return payload;
}

export interface CommentLintOptions {
  hook: boolean;
  mode?: string;
}

export async function runCommentLint(options: CommentLintOptions): Promise<number> {
  if (!options.hook) return 0;

  const payload = parsePayload(await readStdin());
  if (!payload) return 0;

  const cwd = payload.cwd ?? process.cwd();
  const mode = await resolveMode(options.mode, cwd);
  if (mode === "off") return 0;

  const changed = await changedPortion(payload, cwd);
  if (!changed) return 0;

  const filePath = payload.tool_input!.file_path!;
  let issues = lintComments(changed.text, filePath);
  if (changed.added) issues = issues.filter((i) => changed.added!.has(i.line));
  if (issues.length === 0) return 0;

  process.stderr.write(formatIssues(filePath, issues, mode, changed.relative) + "\n");
  return mode === "block" ? 2 : 0;
}
