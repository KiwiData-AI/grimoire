import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  access,
} from "node:fs/promises";
import type { Dirent } from "node:fs";
import {
  join,
  relative,
  resolve,
  extname,
  basename,
  dirname,
} from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { findProjectRoot } from "../utils/paths.js";
import { loadConfig } from "../utils/config.js";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");

// ---------------------------------------------------------------------------
// New public API
// ---------------------------------------------------------------------------

export interface MapOptions {
  duplicates: boolean;
}

interface DriftItem {
  conventionsFile: string;
  path: string;
  context: string;
}

export class McpRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpRequiredError";
  }
}

async function requireMcpConfigured(root: string): Promise<void> {
  const config = await loadConfig(root).catch(() => null);
  if (!config?.project.integrations?.codebase_memory_mcp) {
    console.error(chalk.red("Error: codebase-memory-mcp is required for grimoire map."));
    console.error("Install codebase-memory-mcp and run grimoire init to register it.");
    throw new McpRequiredError("codebase-memory-mcp not configured");
  }
}

const SCANNED_HEADERS = new Set(["## file placement", "## patterns"]);
const SKIP_TOKENS = ["(", ";", "node_modules", "dist", "build", ".git"];

export function extractPathRules(content: string, filename: string): DriftItem[] {
  const items: DriftItem[] = [];
  let inScannedSection = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      inScannedSection = SCANNED_HEADERS.has(trimmed.toLowerCase());
      continue;
    }

    if (!inScannedSection) continue;

    const matches = [...line.matchAll(/`([a-z][^`]+\/)`/g)];
    for (const match of matches) {
      const token = match[1];
      if (SKIP_TOKENS.some((s) => token.includes(s))) continue;
      items.push({ conventionsFile: filename, path: token, context: trimmed });
    }
  }

  return items;
}

async function detectConventionsDrift(root: string): Promise<DriftItem[]> {
  const conventionsDir = join(root, ".grimoire", "docs", "conventions");

  let files: string[];
  try {
    const entries = await readdir(conventionsDir);
    files = (entries as unknown as string[]).filter((f) => f.endsWith(".md"));
  } catch {
    files = [];
  }

  if (files.length === 0) {
    console.log(
      chalk.dim("No conventions files found. Run /grimoire:discover to generate them.")
    );
    return [];
  }

  const driftItems: DriftItem[] = [];

  for (const file of files) {
    const content = await readFile(join(conventionsDir, file), "utf-8");
    const rules = extractPathRules(content, file);

    for (const rule of rules) {
      const resolved = resolve(join(root, rule.path));
      if (!resolved.startsWith(root + "/")) continue;

      try {
        await access(resolved);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          driftItems.push(rule);
        }
      }
    }
  }

  return driftItems;
}

export async function runMap(options: MapOptions): Promise<void> {
  const root = await findProjectRoot();
  await requireMcpConfigured(root);

  const drift = await detectConventionsDrift(root);

  if (drift.length > 0) {
    console.log(chalk.yellow("Drift detected:"));
    for (const item of drift) {
      const relPath = relative(root, resolve(join(root, item.path)));
      console.log(`  ${item.conventionsFile}: ${item.context} — path not found: ${relPath}`);
    }
  } else {
    console.log(chalk.green("No drift detected. Conventions files match the codebase."));
  }

  console.log(
    chalk.dim("For semantic drift (naming, patterns), run /grimoire:discover in an agent session.")
  );

  if (options.duplicates) {
    const dupIgnoreGlobs = await loadDupIgnore(root);
    await runJscpd(root, dupIgnoreGlobs);
  }
}

async function loadDupIgnore(root: string): Promise<Set<string>> {
  const projectPath = join(root, ".grimoire", "dupignore");
  let content: string;
  try {
    content = await readFile(projectPath, "utf-8");
  } catch {
    const templatePath = join(PACKAGE_ROOT, "templates", "dupignore");
    try {
      content = await readFile(templatePath, "utf-8");
    } catch {
      return new Set();
    }
  }
  const patterns = new Set<string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) patterns.add(trimmed);
  }
  return patterns;
}

// ---------------------------------------------------------------------------
// Shared jscpd runner (used by both runMap and generateMap)
// ---------------------------------------------------------------------------

interface CloneInfo {
  firstFile: string;
  firstStartLine: number;
  firstEndLine: number;
  secondFile: string;
  secondStartLine: number;
  secondEndLine: number;
  lines: number;
  tokens: number;
  fragment: string;
}

interface DuplicateReport {
  clones: CloneInfo[];
  totalDuplicatedLines: number;
  percentDuplicated: number;
}

function cloneLoc(loc: unknown): number {
  return (loc as Record<string, number> | undefined)?.line ?? 0;
}

function buildCloneInfo(d: Record<string, unknown>, root: string): CloneInfo {
  const first = d.firstFile as Record<string, unknown>;
  const second = d.secondFile as Record<string, unknown>;
  return {
    firstFile: relative(root, first.name as string),
    firstStartLine: cloneLoc(first.startLoc),
    firstEndLine: cloneLoc(first.endLoc),
    secondFile: relative(root, second.name as string),
    secondStartLine: cloneLoc(second.startLoc),
    secondEndLine: cloneLoc(second.endLoc),
    lines: (d.lines as number) || 0,
    tokens: (d.tokens as number) || 0,
    fragment: ((d.fragment as string) || "").slice(0, 200),
  };
}

function parseJscpdReport(root: string, reportContent: string): DuplicateReport {
  const report = JSON.parse(reportContent) as Record<string, unknown>;
  const clones: CloneInfo[] = ((report.duplicates as unknown[]) || []).map(
    (d) => buildCloneInfo(d as Record<string, unknown>, root)
  );
  const stats = report.statistics as Record<string, unknown> | undefined;
  const totals = (stats?.total as Record<string, number> | undefined);
  const totalLines = totals?.lines || 1;
  const dupLines = totals?.duplicatedLines || 0;
  return {
    clones,
    totalDuplicatedLines: dupLines,
    percentDuplicated: (dupLines / totalLines) * 100,
  };
}

async function runJscpd(
  root: string,
  dupIgnoreGlobs: Set<string>
): Promise<DuplicateReport | null> {
  try {
    await execFileAsync("npx", ["jscpd", "--version"], { cwd: root });
  } catch {
    console.log(chalk.yellow("\njscpd not found. Install with: npm install -g jscpd"));
    console.log(chalk.yellow("Skipping duplicate detection.\n"));
    return null;
  }

  console.log(chalk.dim("\nRunning jscpd duplicate detection..."));

  try {
    const ignoreArg = [...dupIgnoreGlobs].join(",");
    const args = [
      "jscpd",
      root,
      "--reporters", "json",
      "--output", join(root, ".grimoire", "docs"),
      "--silent",
    ];
    if (ignoreArg) args.push("--ignore", ignoreArg);
    await execFileAsync("npx", args, { cwd: root, timeout: 60_000 });
    const reportPath = join(root, ".grimoire", "docs", "jscpd-report.json");
    const reportContent = await readFile(reportPath, "utf-8");
    return parseJscpdReport(root, reportContent);
  } catch (err) {
    console.log(
      chalk.yellow(`\njscpd failed: ${err instanceof Error ? err.message : "unknown error"}`)
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Legacy generateMap — kept to avoid breaking existing tests
// ---------------------------------------------------------------------------

interface LegacyMapOptions {
  json: boolean;
  refresh: boolean;
  maxDepth: number;
  duplicates: boolean;
}

interface DirectoryInfo {
  path: string;
  fileCount: number;
  extensions: Record<string, number>;
  keyFiles: string[];
  subdirs: string[];
}

interface KeyFileInfo {
  path: string;
  type: string;
}

interface MapSnapshot {
  generatedAt: string;
  projectRoot: string;
  directories: DirectoryInfo[];
  keyFiles: KeyFileInfo[];
  undocumented: string[];
  removed: string[];
  duplicates: DuplicateReport | null;
}

function parseIgnoreFile(content: string): Set<string> {
  const patterns = new Set<string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      patterns.add(trimmed);
    }
  }
  return patterns;
}

function parseKeyFilesConfig(content: string): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const filename = trimmed.slice(0, eqIndex).trim();
    const type = trimmed.slice(eqIndex + 1).trim();
    if (filename && type) {
      keys[filename] = type;
    }
  }
  return keys;
}

async function loadConfigFile(root: string, filename: string): Promise<string> {
  const projectPath = join(root, ".grimoire", filename);
  try {
    return await readFile(projectPath, "utf-8");
  } catch {
    const templatePath = join(PACKAGE_ROOT, "templates", filename);
    return await readFile(templatePath, "utf-8");
  }
}

function printMapStructure(directories: DirectoryInfo[], keyFiles: KeyFileInfo[]): void {
  console.log(chalk.bold("\nProject Map\n"));
  console.log(chalk.bold("Structure:"));
  for (const dir of directories) {
    const depth = dir.path === "." ? 0 : dir.path.split("/").length;
    const padding = "  ".repeat(depth);
    const extSummary = Object.entries(dir.extensions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([ext, count]) => `${count} ${ext}`)
      .join(", ");
    const keyFileNote = dir.keyFiles.length > 0 ? chalk.dim(` [${dir.keyFiles.join(", ")}]`) : "";
    console.log(`${padding}${chalk.cyan(dir.path + "/")} ${chalk.dim(extSummary)}${keyFileNote}`);
  }
  if (keyFiles.length > 0) {
    console.log(chalk.bold("\nKey Files:"));
    for (const kf of keyFiles) console.log(`  ${kf.path} ${chalk.dim(`(${kf.type})`)}`);
  }
}

function printDuplicateReport(duplicates: DuplicateReport): void {
  if (duplicates.clones.length === 0) {
    console.log(chalk.green("\nNo duplicates detected."));
    return;
  }
  console.log(chalk.bold.yellow(`\nDuplicates: ${duplicates.clones.length} clone(s), ${duplicates.totalDuplicatedLines} duplicated lines (${duplicates.percentDuplicated.toFixed(1)}%)\n`));
  for (const clone of duplicates.clones.slice(0, 10)) {
    console.log(`  ${chalk.dim(clone.firstFile)}:${clone.firstStartLine}-${clone.firstEndLine}`);
    console.log(`  ${chalk.dim(clone.secondFile)}:${clone.secondStartLine}-${clone.secondEndLine}`);
    console.log(`  ${chalk.dim(`${clone.lines} lines, ${clone.tokens} tokens`)}\n`);
  }
  if (duplicates.clones.length > 10) {
    console.log(chalk.dim(`  ... and ${duplicates.clones.length - 10} more (see .snapshot.json for full list)`));
  }
}

function printRefreshReport(undocumented: string[], removed: string[]): void {
  if (undocumented.length > 0) {
    console.log(chalk.bold.yellow("\nUndocumented areas:"));
    for (const u of undocumented) console.log(`  ${chalk.yellow("+")} ${u}/`);
  }
  if (removed.length > 0) {
    console.log(chalk.bold.red("\nRemoved (docs may be stale):"));
    for (const r of removed) console.log(`  ${chalk.red("-")} ${r}/`);
  }
  if (undocumented.length === 0 && removed.length === 0) {
    console.log(chalk.green("\nAll areas are documented. No changes detected."));
  }
}

export async function generateMap(options: LegacyMapOptions): Promise<void> {
  const root = await findProjectRoot();
  const docsDir = join(root, ".grimoire", "docs");

  const ignorePatterns = parseIgnoreFile(await loadConfigFile(root, "mapignore"));
  const keyFilePatterns = parseKeyFilesConfig(await loadConfigFile(root, "mapkeys"));
  const dupIgnoreGlobs = parseIgnoreFile(await loadConfigFile(root, "dupignore"));

  const directories: DirectoryInfo[] = [];
  const keyFiles: KeyFileInfo[] = [];
  await scanDirectory(root, root, 0, options.maxDepth, directories, keyFiles, ignorePatterns, keyFilePatterns);

  const existingAreas = options.refresh ? await loadExistingAreas(docsDir) : [];
  const scannedDirs = new Set(directories.map((d) => d.path));
  const undocumented = directories.filter((d) => !existingAreas.includes(d.path) && d.fileCount > 0).map((d) => d.path);
  const removed = existingAreas.filter((a) => !scannedDirs.has(a));
  const duplicates = options.duplicates ? await runJscpd(root, dupIgnoreGlobs) : null;

  const snapshot: MapSnapshot = { generatedAt: new Date().toISOString(), projectRoot: ".", directories, keyFiles, undocumented, removed, duplicates };

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  printMapStructure(directories, keyFiles);
  if (duplicates) printDuplicateReport(duplicates);
  if (options.refresh) {
    printRefreshReport(undocumented, removed);
  } else {
    console.log(chalk.dim(`\n${directories.length} directories, ${keyFiles.length} key files found.`));
    console.log(chalk.dim("Run /grimoire:discover to generate area docs from this snapshot."));
  }

  await mkdir(docsDir, { recursive: true });
  await writeFile(join(docsDir, ".snapshot.json"), JSON.stringify(snapshot, null, 2));
  console.log(chalk.dim(`\nSnapshot saved to .grimoire/docs/.snapshot.json`));
}

function shouldSkipDir(depth: number, dirName: string, ignorePatterns: Set<string>): boolean {
  if (depth === 0) return false;
  return ignorePatterns.has(dirName) || (dirName.startsWith(".") && dirName !== ".grimoire");
}

function processFiles(
  files: Dirent<string>[],
  relPath: string,
  keyFilePatterns: Record<string, string>,
  keyFiles: KeyFileInfo[]
): { extensions: Record<string, number>; dirKeyFiles: string[] } {
  const extensions: Record<string, number> = {};
  const dirKeyFiles: string[] = [];
  for (const file of files) {
    const ext = extname(file.name) || file.name;
    extensions[ext] = (extensions[ext] || 0) + 1;
    if (keyFilePatterns[file.name]) {
      keyFiles.push({ path: relPath === "." ? file.name : `${relPath}/${file.name}`, type: keyFilePatterns[file.name] });
      dirKeyFiles.push(file.name);
    }
  }
  return { extensions, dirKeyFiles };
}

async function scanDirectory(
  fullPath: string,
  root: string,
  depth: number,
  maxDepth: number,
  directories: DirectoryInfo[],
  keyFiles: KeyFileInfo[],
  ignorePatterns: Set<string>,
  keyFilePatterns: Record<string, string>
): Promise<void> {
  if (depth > maxDepth) return;

  const relPath = relative(root, fullPath) || ".";
  if (shouldSkipDir(depth, basename(fullPath), ignorePatterns)) return;

  let entries;
  try {
    entries = await readdir(fullPath, { withFileTypes: true });
  } catch {
    return;
  }

  const files = entries.filter((e) => e.isFile()) as Dirent<string>[];
  const subdirs = entries
    .filter((e) => e.isDirectory())
    .filter((e) => !ignorePatterns.has(e.name as string) && (!(e.name as string).startsWith(".") || e.name === ".grimoire")) as Dirent<string>[];

  const { extensions, dirKeyFiles } = processFiles(files, relPath, keyFilePatterns, keyFiles);

  if (files.length > 0 || depth <= 1) {
    directories.push({ path: relPath, fileCount: files.length, extensions, keyFiles: dirKeyFiles, subdirs: subdirs.map((s) => s.name) });
  }

  for (const subdir of subdirs) {
    await scanDirectory(join(fullPath, subdir.name), root, depth + 1, maxDepth, directories, keyFiles, ignorePatterns, keyFilePatterns);
  }
}

async function loadExistingAreas(docsDir: string): Promise<string[]> {
  try {
    const indexContent = await readFile(join(docsDir, "index.yml"), "utf-8");
    const areas: string[] = [];
    const dirMatches = indexContent.matchAll(/directory:\s*(.+)/g);
    for (const match of dirMatches) {
      areas.push(match[1].trim());
    }
    return areas;
  } catch {
    return [];
  }
}
