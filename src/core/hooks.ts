import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { fileExists } from "../utils/fs.js";

interface HookConfig {
  hooks: {
    PreCommit?: HookEntry[];
    PostCommit?: HookEntry[];
  };
}

interface HookEntry {
  matcher: string;
  command: string;
}


export async function setupHooks(root: string): Promise<void> {
  await setupClaudeHooks(root);
  await setupClaudeSettings(root);
  await setupGitHooks(root);
}


// Grimoire-owned command ledgers, oldest first; the last entry is installed.
// When changing a command, append it — earlier entries upgrade in place on update.
const CLAUDE_CHECK_COMMANDS = [
  "grimoire check --changed --json",
  "grimoire check --changed --json --skip best_practices",
];
const GIT_CHECK_COMMANDS = [
  "grimoire check --changed",
  "grimoire check --changed --skip best_practices",
];
const CURRENT_CLAUDE_CHECK = CLAUDE_CHECK_COMMANDS[CLAUDE_CHECK_COMMANDS.length - 1];
const CURRENT_GIT_CHECK = GIT_CHECK_COMMANDS[GIT_CHECK_COMMANDS.length - 1];
const CLAUDE_COMMAND_UPGRADES = new Map(
  CLAUDE_CHECK_COMMANDS.slice(0, -1).map((stale) => [stale, CURRENT_CLAUDE_CHECK])
);
const STALE_GIT_CHECK_COMMANDS = new Set(GIT_CHECK_COMMANDS.slice(0, -1));

async function setupClaudeHooks(root: string): Promise<void> {
  const claudeDir = join(root, ".claude");
  const hooksPath = join(claudeDir, "hooks.json");

  const hooks: HookConfig = {
    hooks: {
      PreCommit: [
        {
          matcher: "*",
          // Fast deterministic checks only — the LLM best_practices review is
          // excluded from the blocking commit gate (slow + non-deterministic).
          // Run it explicitly at review time: grimoire check best_practices
          command: CURRENT_CLAUDE_CHECK,
        },
      ],
      PostCommit: [
        {
          matcher: "*",
          command: trailerCheckScript(),
        },
      ],
    },
  };

  await mkdir(claudeDir, { recursive: true });

  if (await fileExists(hooksPath)) {
    // Merge with existing hooks — don't overwrite user config
    try {
      const existing = JSON.parse(await readFile(hooksPath, "utf-8")) as HookConfig;
      const merged = mergeHooks(existing, hooks);
      await writeFile(hooksPath, JSON.stringify(merged, null, 2) + "\n");
      console.log(`  ${chalk.blue("merged")}  .claude/hooks.json`);
    } catch {
      // Existing file is malformed — back it up and replace
      await writeFile(hooksPath + ".bak", await readFile(hooksPath, "utf-8"));
      await writeFile(hooksPath, JSON.stringify(hooks, null, 2) + "\n");
      console.log(`  ${chalk.yellow("replaced")} .claude/hooks.json (old file backed up)`);
    }
  } else {
    await writeFile(hooksPath, JSON.stringify(hooks, null, 2) + "\n");
    console.log(`  ${chalk.green("created")} .claude/hooks.json`);
  }
}


// Removes every stale grimoire-owned check line, substituting the current
// command for the first unless some line already contains it.
function upgradeStaleGitLines(existing: string): string | null {
  const lines = existing.split("\n");
  if (!lines.some((l) => STALE_GIT_CHECK_COMMANDS.has(l.trim()))) return null;

  let replaced = lines.some((l) => l.includes(CURRENT_GIT_CHECK));
  const updated: string[] = [];
  for (const line of lines) {
    if (STALE_GIT_CHECK_COMMANDS.has(line.trim())) {
      if (!replaced) {
        updated.push((line.match(/^\s*/)?.[0] ?? "") + CURRENT_GIT_CHECK);
        replaced = true;
      }
      continue;
    }
    updated.push(line);
  }
  return updated.join("\n");
}

async function setupGitHooks(root: string): Promise<void> {
  const gitHooksDir = join(root, ".git", "hooks");

  // Only create if .git exists (this is a git repo)
  if (!(await fileExists(join(root, ".git")))) return;

  const preCommitPath = join(gitHooksDir, "pre-commit");

  // Don't overwrite existing hooks
  if (await fileExists(preCommitPath)) {
    const existing = await readFile(preCommitPath, "utf-8");

    const upgraded = upgradeStaleGitLines(existing);
    if (upgraded !== null) {
      await writeFile(preCommitPath, upgraded);
      console.log(`  ${chalk.blue("updated")} .git/hooks/pre-commit (stale grimoire check upgraded)`);
      return;
    }

    if (existing.includes("grimoire check")) {
      console.log(`  ${chalk.yellow("exists")}  .git/hooks/pre-commit (already has grimoire)`);
      return;
    }
    // Check if existing hook has exit/exec that would prevent our code from running
    if (/^[^#]*\b(exit\s|exec\s)/m.test(existing)) {
      console.log(`  ${chalk.yellow("manual")}  .git/hooks/pre-commit contains exit/exec — add manually: ${CURRENT_GIT_CHECK}`);
      return;
    }
    // Append grimoire check to existing hook
    const appended = existing.trimEnd() + "\n\n# Grimoire pre-commit checks\n" + CURRENT_GIT_CHECK + "\n";
    await writeFile(preCommitPath, appended);
    console.log(`  ${chalk.blue("appended")} .git/hooks/pre-commit`);
    return;
  }

  await mkdir(gitHooksDir, { recursive: true });

  const hookScript = `#!/bin/sh
# Grimoire pre-commit checks
# Generated by grimoire init — safe to customize

# Fast, deterministic checks only. The LLM best_practices review is excluded
# from the blocking pre-commit on purpose: it is slow and non-deterministic
# (different findings each run), which turns committing into a fix-loop. Run it
# explicitly at review/pre-push time:  grimoire check best_practices
if command -v grimoire >/dev/null 2>&1; then
  ${CURRENT_GIT_CHECK}
fi
`;

  await writeFile(preCommitPath, hookScript);
  await chmod(preCommitPath, 0o755);
  console.log(`  ${chalk.green("created")} .git/hooks/pre-commit`);
}


interface ClaudeSettings {
  hooks?: Record<string, ClaudeHookEntry[]>;
  [key: string]: unknown;
}

interface ClaudeHookEntry {
  matcher?: string;
  hooks: Array<{ type: string; command: string }>;
}

const BRANCH_GUARD_COMMAND = "grimoire branch-check --hook";
const BRANCH_GUARD_MARKER = "grimoire branch-check";
const COMMENT_LINT_COMMAND = "grimoire lint-comments --hook";
const COMMENT_LINT_MARKER = "grimoire lint-comments";

/** True if any entry already wires a command containing `marker`. */
function hasHook(entries: ClaudeHookEntry[], marker: string): boolean {
  return entries.some((entry) => entry.hooks?.some((h) => h.command?.includes(marker)));
}

interface LoadedSettings {
  settings: ClaudeSettings;
  existed: boolean;
  wasMalformed: boolean;
}

async function readClaudeSettings(settingsPath: string): Promise<LoadedSettings> {
  if (!(await fileExists(settingsPath))) {
    return { settings: {}, existed: false, wasMalformed: false };
  }
  const raw = await readFile(settingsPath, "utf-8");
  try {
    return { settings: JSON.parse(raw) as ClaudeSettings, existed: true, wasMalformed: false };
  } catch {
    await writeFile(settingsPath + ".bak", raw);
    return { settings: {}, existed: true, wasMalformed: true };
  }
}

function logSettings(existed: boolean, wasMalformed: boolean): void {
  const verb = !existed ? "created" : wasMalformed ? "replaced" : "updated";
  const color = verb === "created" ? "green" : verb === "replaced" ? "yellow" : "blue";
  console.log(`  ${chalk[color](verb)} .claude/settings.json (branch-check + comment-lint hooks)`);
}

async function setupClaudeSettings(root: string): Promise<void> {
  const settingsPath = join(root, ".claude", "settings.json");
  const { settings, existed, wasMalformed } = await readClaudeSettings(settingsPath);

  const hooks = settings.hooks ?? {};
  const userPromptSubmit = hooks.UserPromptSubmit ?? [];
  const preToolUse = hooks.PreToolUse ?? [];

  let changed = false;
  if (!hasHook(userPromptSubmit, BRANCH_GUARD_MARKER)) {
    userPromptSubmit.push({ hooks: [{ type: "command", command: BRANCH_GUARD_COMMAND }] });
    changed = true;
  }
  if (!hasHook(preToolUse, COMMENT_LINT_MARKER)) {
    preToolUse.push({ matcher: "Write|Edit", hooks: [{ type: "command", command: COMMENT_LINT_COMMAND }] });
    changed = true;
  }

  if (!changed) {
    console.log(`  ${chalk.yellow("exists")}  .claude/settings.json (branch-check + comment-lint hooks)`);
    return;
  }

  hooks.UserPromptSubmit = userPromptSubmit;
  hooks.PreToolUse = preToolUse;
  settings.hooks = hooks;

  await mkdir(join(root, ".claude"), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  logSettings(existed, wasMalformed);
}

function trailerCheckScript(): string {
  // Inline shell command that checks for Change: trailer
  // Only enforces when there are active grimoire changes
  return `sh -c 'if [ -d .grimoire/changes ] && [ "$(ls -A .grimoire/changes 2>/dev/null)" ]; then TRAILER=$(git log -1 --format="%(trailers:key=Change)" 2>/dev/null); if [ -z "$TRAILER" ]; then echo "WARNING: Commit is missing Change: trailer. Active grimoire changes exist."; fi; fi'`;
}

// Entry commands come from a user-edited file, so read them defensively.
function commandOf(entry: { command?: unknown }): string {
  return typeof entry.command === "string" ? entry.command : "";
}

// Upgrades stale grimoire-owned commands in place (keeping the user's matcher);
// foreign phases and unexpected shapes pass through untouched.
function mergeHooks(existing: HookConfig, additions: HookConfig): HookConfig {
  const merged: HookConfig = { hooks: { ...(existing.hooks ?? {}) } };

  for (const [phase, entries] of Object.entries(additions.hooks)) {
    const key = phase as keyof HookConfig["hooks"];
    const raw = merged.hooks[key];
    if (raw !== undefined && !Array.isArray(raw)) continue;
    const existingEntries = raw ?? [];

    const newEntries = entries ?? [];

    const upgraded = existingEntries.map((e) => {
      const current = CLAUDE_COMMAND_UPGRADES.get(commandOf(e));
      return current ? { ...e, command: current } : e;
    });

    // Grimoire-owned commands collapse by command (first entry wins, keeping
    // its matcher); everything else keeps matcher+command identity.
    const grimoireCommands = new Set(newEntries.map(commandOf));
    const seen = new Set<string>();
    const deduped = upgraded.filter((e) => {
      const cmd = commandOf(e);
      const id = grimoireCommands.has(cmd) ? cmd : `${e.matcher} ${cmd}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const hasCheckVariant = deduped.some((e) => commandOf(e).startsWith("grimoire check"));
    const commands = new Set(deduped.map(commandOf));
    const toAdd = newEntries.filter(
      (e) =>
        !commands.has(commandOf(e)) &&
        !(commandOf(e).startsWith("grimoire check") && hasCheckVariant)
    );

    merged.hooks[key] = [...deduped, ...toAdd];
  }

  return merged;
}
