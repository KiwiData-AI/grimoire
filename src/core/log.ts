import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { findProjectRoot } from "../utils/paths.js";

const execFileAsync = promisify(execFile);

interface LogOptions {
  from?: string;
  to?: string;
  json: boolean;
}

interface ArchiveEntry {
  date: string;
  changeId: string;
  summary: string;
  why: string;
  features: string[];
  decisions: string[];
  scenarios: string[];
}

export async function generateLog(options: LogOptions): Promise<void> {
  const root = await findProjectRoot();
  const archiveDir = join(root, ".grimoire", "archive");

  let entries: ArchiveEntry[];
  try {
    entries = await readArchiveEntries(archiveDir);
  } catch {
    console.error(chalk.red("No archive found. No changes have been archived yet."));
    process.exit(1);
  }

  if (entries.length === 0) {
    console.log(chalk.dim("No archived changes found."));
    return;
  }

  // Filter by date range if tags/dates provided
  if (options.from || options.to) {
    const fromDate = options.from
      ? await resolveDate(root, options.from)
      : "";
    const toDate = options.to
      ? await resolveDate(root, options.to)
      : "9999-99-99";

    entries = entries.filter(
      (e) => e.date >= fromDate && e.date <= toDate
    );
  }

  // Sort newest first
  entries.sort((a, b) => b.date.localeCompare(a.date));

  if (options.json) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  // Pretty output
  console.log(chalk.bold("Grimoire Change Log\n"));

  let currentMonth = "";
  for (const entry of entries) {
    const month = entry.date.slice(0, 7); // YYYY-MM
    if (month !== currentMonth) {
      currentMonth = month;
      console.log(chalk.bold.underline(`\n${formatMonth(month)}\n`));
    }

    console.log(
      `  ${chalk.dim(entry.date)}  ${chalk.cyan(entry.changeId)}`
    );
    console.log(`  ${entry.summary}`);

    if (entry.features.length > 0) {
      console.log(
        `  ${chalk.dim("Features:")} ${entry.features.join(", ")}`
      );
    }
    if (entry.decisions.length > 0) {
      console.log(
        `  ${chalk.dim("Decisions:")} ${entry.decisions.join(", ")}`
      );
    }
    if (entry.scenarios.length > 0) {
      const display =
        entry.scenarios.length <= 3
          ? entry.scenarios.join(", ")
          : `${entry.scenarios.slice(0, 3).join(", ")} +${entry.scenarios.length - 3} more`;
      console.log(`  ${chalk.dim("Scenarios:")} ${display}`);
    }
    console.log();
  }

  console.log(chalk.dim(`${entries.length} change(s) total`));
}

async function readArchiveEntries(
  archiveDir: string
): Promise<ArchiveEntry[]> {
  const dirs = await readdir(archiveDir, { withFileTypes: true });
  const entries: ArchiveEntry[] = [];

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;

    // Directory name format: YYYY-MM-DD-<change-id>
    const match = dir.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
    if (!match) continue;

    const [, date, changeId] = match;
    const manifestPath = join(archiveDir, dir.name, "manifest.md");

    let manifest: string;
    try {
      manifest = await readFile(manifestPath, "utf-8");
    } catch {
      continue;
    }

    entries.push({
      date,
      changeId,
      ...parseManifest(manifest),
    });
  }

  return entries;
}

function parseManifest(content: string): {
  summary: string;
  why: string;
  features: string[];
  decisions: string[];
  scenarios: string[];
} {
  // Extract title: # Change: <summary>
  const titleMatch = content.match(/^#\s+Change:\s*(.+)$/m);
  const summary = titleMatch ? titleMatch[1].trim() : "(no summary)";

  // Extract why section
  const whyMatch = content.match(
    /^##\s+Why\s*\n([\s\S]*?)(?=^##|\Z)/m
  );
  const why = whyMatch ? whyMatch[1].trim() : "";

  // Extract feature changes
  const features: string[] = [];
  const featurePattern = /\*\*(?:ADDED|MODIFIED|REMOVED)\*\*\s+`([^`]+\.feature)`/g;
  let m;
  while ((m = featurePattern.exec(content)) !== null) {
    features.push(m[1]);
  }

  // Extract decisions
  const decisions: string[] = [];
  const decisionPattern = /\*\*(?:ADDED|MODIFIED|SUPERSEDED)\*\*\s+`(\d{4}-[^`]+\.md)`/g;
  while ((m = decisionPattern.exec(content)) !== null) {
    decisions.push(m[1]);
  }

  // Extract scenarios
  const scenarios: string[] = [];
  const scenarioPattern = /"([^"]+)"/g;
  const scenarioSection = content.match(
    /^##\s+Scenarios\s+(?:Added|Modified)\s*\n([\s\S]*?)(?=^##|\Z)/gm
  );
  if (scenarioSection) {
    for (const section of scenarioSection) {
      while ((m = scenarioPattern.exec(section)) !== null) {
        scenarios.push(m[1]);
      }
    }
  }

  return { summary, why, features, decisions, scenarios };
}

/**
 * Resolve a git tag or date string to an ISO date.
 * If it looks like a date already, return it. Otherwise try git tag.
 */
async function resolveDate(
  root: string,
  ref: string
): Promise<string> {
  if (/^\d{4}-\d{2}-\d{2}$/.test(ref)) {
    return ref;
  }

  // Try as a git tag
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "-1", "--format=%aI", ref],
      { cwd: root }
    );
    return stdout.trim().split("T")[0];
  } catch {
    console.error(
      chalk.yellow(`Warning: Could not resolve "${ref}" as a git tag or date. Using as-is.`)
    );
    return ref;
  }
}

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}
