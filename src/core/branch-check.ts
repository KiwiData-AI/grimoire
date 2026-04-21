import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { findProjectRoot } from "../utils/paths.js";
import { fileExists } from "../utils/fs.js";

const execFileAsync = promisify(execFile);

const FEATURE_WORD = "(?:feature|capability|functionality)(?![-\\w])";
const NEW_FEATURE_PATTERNS: RegExp[] = [
  new RegExp(
    `\\b(?:new|add|build|implement|create|start|draft)\\s+(?:a\\s+|an\\s+|another\\s+|the\\s+)?(?:new\\s+)?${FEATURE_WORD}`,
    "i"
  ),
  new RegExp(`\\b${FEATURE_WORD}\\s+(?:request|idea|proposal)\\b`, "i"),
  /\bi\s+(?:want|need|would\s+like)\s+(?:to\s+)?(?:add|build|implement|create)\b/i,
  new RegExp(
    `\\blet'?s\\s+(?:add|build|implement|create|start)\\s+(?:a\\s+)?(?:new\\s+)?${FEATURE_WORD}`,
    "i"
  ),
  new RegExp(
    `\\b(?:spec|draft)\\s+(?:out\\s+)?(?:a\\s+)?(?:new\\s+)?${FEATURE_WORD}`,
    "i"
  ),
];

const PROTECTED_BRANCHES = new Set([
  "main",
  "master",
  "develop",
  "trunk",
]);

interface HookPayload {
  prompt?: string;
  cwd?: string;
}

interface BranchState {
  current: string | null;
  dirty: boolean;
}

interface ActiveChange {
  id: string;
  branch: string | null;
  status: string;
}

export interface BranchCheckResult {
  triggered: boolean;
  reason?: string;
  suggestion?: string;
  state?: {
    branch: string | null;
    dirty: boolean;
    activeChange: ActiveChange | null;
    protected: boolean;
  };
}

export function detectNewFeatureIntent(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (!trimmed) return false;
  return NEW_FEATURE_PATTERNS.some((re) => re.test(trimmed));
}

async function getBranchState(cwd: string): Promise<BranchState> {
  let current: string | null = null;
  try {
    const { stdout } = await execFileAsync("git", ["branch", "--show-current"], { cwd });
    current = stdout.trim() || null;
  } catch {
    current = null;
  }

  let dirty = false;
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd });
    dirty = stdout.split("\n").some((l) => l.trim().length > 0);
  } catch {
    dirty = false;
  }

  return { current, dirty };
}

async function listActiveChanges(root: string): Promise<ActiveChange[]> {
  const changesDir = join(root, ".grimoire", "changes");
  if (!(await fileExists(changesDir))) return [];

  const entries = await readdir(changesDir, { withFileTypes: true });
  const results: ActiveChange[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(changesDir, entry.name, "manifest.md");
    if (!(await fileExists(manifestPath))) continue;

    try {
      const raw = await readFile(manifestPath, "utf-8");
      const parsed = matter(raw);
      const data = parsed.data as { branch?: string; status?: string };
      results.push({
        id: entry.name,
        branch: data.branch ?? null,
        status: data.status ?? "draft",
      });
    } catch {
      // Skip malformed manifests
    }
  }

  return results;
}

function findChangeForBranch(
  changes: ActiveChange[],
  branch: string | null
): ActiveChange | null {
  if (!branch) return null;
  return changes.find((c) => c.branch === branch) ?? null;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "for", "of", "in", "on", "with", "and", "or",
  "i", "we", "us", "you", "it", "is", "be", "do", "does", "please", "can",
  "could", "would", "should", "want", "need", "like", "add", "new",
  "build", "implement", "create", "start", "draft", "feature", "let",
  "lets", "make", "have", "has", "that", "this",
]);

export function suggestBranchName(prompt: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .slice(0, 4);
  const slug = words.join("-").slice(0, 40) || "new-feature";
  return `feat/${slug}`;
}

function collectConcerns(
  state: BranchState,
  activeChange: ActiveChange | null,
  isProtected: boolean,
  totalChanges: number
): string[] {
  const concerns: string[] = [];
  if (state.dirty) {
    concerns.push(`uncommitted changes on '${state.current ?? "(unknown)"}'`);
  }
  if (activeChange) {
    concerns.push(
      `branch '${state.current}' is tied to active grimoire change '${activeChange.id}' (status: ${activeChange.status})`
    );
  } else if (state.current && !isProtected && totalChanges > 0) {
    concerns.push(
      `currently on feature branch '${state.current}' but no active grimoire change matches it`
    );
  }
  return concerns;
}

export async function evaluateBranchCheck(
  prompt: string,
  cwd: string
): Promise<BranchCheckResult> {
  if (!detectNewFeatureIntent(prompt)) return { triggered: false };

  let root: string;
  try {
    root = await findProjectRoot();
  } catch {
    root = cwd;
  }

  const [state, changes] = await Promise.all([
    getBranchState(cwd),
    listActiveChanges(root),
  ]);

  const isProtected = state.current ? PROTECTED_BRANCHES.has(state.current) : false;
  const activeChange = findChangeForBranch(changes, state.current);
  const concerns = collectConcerns(state, activeChange, isProtected, changes.length);
  const stateSummary = {
    branch: state.current,
    dirty: state.dirty,
    activeChange,
    protected: isProtected,
  };

  if (concerns.length === 0) {
    return { triggered: false, state: stateSummary };
  }

  return {
    triggered: true,
    reason: `New feature request detected while ${concerns.join(" AND ")}.`,
    suggestion: suggestBranchName(prompt),
    state: stateSummary,
  };
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

function formatHookMessage(result: BranchCheckResult): string {
  const lines: string[] = [
    "[grimoire-branch-guard] Branch hygiene warning for new-feature request:",
    `  ${result.reason}`,
    "",
    "Before drafting, invoke the grimoire-branch-guard skill to:",
    "  1. Commit or stash in-progress work on the current branch",
    "  2. Create a new branch for this request",
    `     Suggested: git switch -c ${result.suggestion}`,
    "",
    "Do not piggy-back new features onto an in-progress branch.",
  ];
  return lines.join("\n");
}

interface BranchCheckOptions {
  hook: boolean;
  prompt?: string;
  json: boolean;
}

async function resolveHookInput(): Promise<{ prompt: string; cwd: string }> {
  const raw = await readStdin();
  const cwd = process.cwd();
  if (!raw) return { prompt: "", cwd };
  try {
    const payload = JSON.parse(raw) as HookPayload;
    return { prompt: payload.prompt ?? "", cwd: payload.cwd ?? cwd };
  } catch {
    return { prompt: raw, cwd };
  }
}

export async function runBranchCheck(options: BranchCheckOptions): Promise<number> {
  const source = options.hook
    ? await resolveHookInput()
    : { prompt: options.prompt ?? "", cwd: process.cwd() };

  if (!source.prompt.trim()) {
    if (options.json) process.stdout.write(JSON.stringify({ triggered: false }) + "\n");
    return 0;
  }

  const result = await evaluateBranchCheck(source.prompt, source.cwd);

  if (options.json) {
    process.stdout.write(JSON.stringify(result) + "\n");
    return 0;
  }

  if (result.triggered) process.stdout.write(formatHookMessage(result) + "\n");
  return 0;
}
