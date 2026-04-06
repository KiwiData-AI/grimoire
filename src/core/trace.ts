import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { findProjectRoot } from "../utils/paths.js";

const execFileAsync = promisify(execFile);

interface TraceOptions {
  json: boolean;
}

interface TraceResult {
  file: string;
  line?: number;
  commits: CommitTrace[];
  changes: ChangeTrace[];
}

interface CommitTrace {
  hash: string;
  date: string;
  author: string;
  subject: string;
  changeId?: string;
}

interface ChangeTrace {
  changeId: string;
  date: string;
  summary: string;
  why: string;
  features: string[];
  decisions: string[];
  archived: boolean;
}

export async function traceFile(
  target: string,
  options: TraceOptions
): Promise<void> {
  const root = await findProjectRoot();

  // Parse target: could be "file.ts", "file.ts:42", or "file.ts:10-20"
  const { file, line } = parseTarget(target);
  const relFile = relative(root, join(process.cwd(), file));

  // Step 1: Get commits that touched this file/line
  const commits = await getCommits(root, relFile, line);

  if (commits.length === 0) {
    console.log(chalk.dim(`No git history found for ${relFile}`));
    return;
  }

  // Step 2: Extract change IDs from commit trailers
  const changeIds = new Set<string>();
  for (const c of commits) {
    if (c.changeId) changeIds.add(c.changeId);
  }

  // Step 3: Look up change details from archive and active changes
  const changes = await lookupChanges(root, changeIds);

  const result: TraceResult = { file: relFile, line, commits, changes };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Pretty output
  console.log(chalk.bold(`\nTrace: ${relFile}${line ? `:${line}` : ""}\n`));

  // Show commits
  console.log(chalk.bold.underline("Commits\n"));
  for (const c of commits.slice(0, 20)) {
    const changeTag = c.changeId
      ? chalk.cyan(` [${c.changeId}]`)
      : "";
    console.log(
      `  ${chalk.dim(c.hash.slice(0, 8))}  ${chalk.dim(c.date)}  ${c.subject}${changeTag}`
    );
  }
  if (commits.length > 20) {
    console.log(chalk.dim(`  ... and ${commits.length - 20} more`));
  }

  // Show linked changes
  if (changes.length > 0) {
    console.log(chalk.bold.underline("\nLinked Changes\n"));
    for (const ch of changes) {
      const status = ch.archived
        ? chalk.green("archived")
        : chalk.yellow("active");
      console.log(
        `  ${chalk.cyan(ch.changeId)}  ${chalk.dim(ch.date)}  ${status}`
      );
      console.log(`  ${ch.summary}`);
      if (ch.why) {
        console.log(`  ${chalk.dim("Why:")} ${ch.why}`);
      }
      if (ch.features.length > 0) {
        console.log(
          `  ${chalk.dim("Features:")} ${ch.features.join(", ")}`
        );
      }
      if (ch.decisions.length > 0) {
        console.log(
          `  ${chalk.dim("Decisions:")} ${ch.decisions.join(", ")}`
        );
      }
      console.log();
    }
  } else if (changeIds.size === 0) {
    console.log(
      chalk.dim(
        "\nNo grimoire change IDs found in commit trailers.\nCommits without a Change: trailer are not linked to grimoire changes.\n"
      )
    );
  }
}

function parseTarget(target: string): { file: string; line?: number } {
  // Match file.ts:42 or file.ts:10-20 (use start line)
  const match = target.match(/^(.+):(\d+)(?:-\d+)?$/);
  if (match) {
    return { file: match[1], line: parseInt(match[2], 10) };
  }
  return { file: target };
}

async function getCommits(
  root: string,
  relFile: string,
  line?: number
): Promise<CommitTrace[]> {
  const commits: CommitTrace[] = [];

  try {
    // Use git log with trailer parsing
    // Format: hash|date|author|subject|trailers
    const args = [
      "log",
      "--format=%H%x1f%as%x1f%an%x1f%s%x1f%(trailers:key=Change,valueonly,separator=%x00)",
      "--follow",
    ];

    if (line) {
      args.push(`-L${line},${line}:${relFile}`);
      // -L doesn't support --follow, remove it
      args.splice(args.indexOf("--follow"), 1);
    } else {
      args.push("--", relFile);
    }

    const { stdout } = await execFileAsync("git", args, { cwd: root });

    for (const rawLine of stdout.trim().split("\n")) {
      if (!rawLine) continue;

      // For -L format, git outputs diff lines too — only parse our format lines
      const parts = rawLine.split("\x1f");
      if (parts.length < 4) continue;
      if (!/^[0-9a-f]{40}$/.test(parts[0])) continue;

      const [hash, date, author, subject, ...trailerParts] = parts;
      const changeTrailer = trailerParts.join("").trim();

      commits.push({
        hash,
        date,
        author,
        subject,
        changeId: changeTrailer || undefined,
      });
    }
  } catch {
    // git log failed — likely not a git repo or file has no history
  }

  // Deduplicate (git -L can produce dupes)
  const seen = new Set<string>();
  return commits.filter((c) => {
    if (seen.has(c.hash)) return false;
    seen.add(c.hash);
    return true;
  });
}

async function lookupChanges(
  root: string,
  changeIds: Set<string>
): Promise<ChangeTrace[]> {
  const changes: ChangeTrace[] = [];

  for (const changeId of changeIds) {
    // Check archive first
    const archiveEntry = await findInArchive(root, changeId);
    if (archiveEntry) {
      changes.push(archiveEntry);
      continue;
    }

    // Check active changes
    const activeEntry = await findInActive(root, changeId);
    if (activeEntry) {
      changes.push(activeEntry);
    }
  }

  // Sort by date, newest first
  changes.sort((a, b) => b.date.localeCompare(a.date));
  return changes;
}

async function findInArchive(
  root: string,
  changeId: string
): Promise<ChangeTrace | null> {
  const archiveDir = join(root, ".grimoire", "archive");

  let dirs: string[];
  try {
    const entries = await readdir(archiveDir);
    dirs = entries.filter((d) => d.endsWith(`-${changeId}`));
  } catch {
    return null;
  }

  if (dirs.length === 0) return null;

  const dir = dirs[0];
  const match = dir.match(/^(\d{4}-\d{2}-\d{2})-/);
  const date = match ? match[1] : "";

  const manifestPath = join(archiveDir, dir, "manifest.md");
  try {
    const manifest = await readFile(manifestPath, "utf-8");
    const parsed = parseManifest(manifest);
    return {
      changeId,
      date,
      archived: true,
      ...parsed,
    };
  } catch {
    return { changeId, date, summary: "(manifest not readable)", why: "", features: [], decisions: [], archived: true };
  }
}

async function findInActive(
  root: string,
  changeId: string
): Promise<ChangeTrace | null> {
  const manifestPath = join(root, ".grimoire", "changes", changeId, "manifest.md");

  try {
    const manifest = await readFile(manifestPath, "utf-8");
    const parsed = parseManifest(manifest);
    return {
      changeId,
      date: "(active)",
      archived: false,
      ...parsed,
    };
  } catch {
    return null;
  }
}

function parseManifest(content: string): {
  summary: string;
  why: string;
  features: string[];
  decisions: string[];
} {
  const titleMatch = content.match(/^#\s+Change:\s*(.+)$/m);
  const summary = titleMatch ? titleMatch[1].trim() : "(no summary)";

  const whyMatch = content.match(
    /^##\s+Why\s*\n([\s\S]*?)(?=^##|\Z)/m
  );
  const why = whyMatch ? whyMatch[1].trim() : "";

  const features: string[] = [];
  const featurePattern = /\*\*(?:ADDED|MODIFIED|REMOVED)\*\*\s+`([^`]+\.feature)`/g;
  let m;
  while ((m = featurePattern.exec(content)) !== null) {
    features.push(m[1]);
  }

  const decisions: string[] = [];
  const decisionPattern = /\*\*(?:ADDED|MODIFIED|SUPERSEDED)\*\*\s+`(\d{4}-[^`]+\.md)`/g;
  while ((m = decisionPattern.exec(content)) !== null) {
    decisions.push(m[1]);
  }

  return { summary, why, features, decisions };
}
