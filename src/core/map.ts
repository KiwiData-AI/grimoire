import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative, extname, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { findProjectRoot } from "../utils/paths.js";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");

interface MapOptions {
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

interface MapSnapshot {
  generatedAt: string;
  projectRoot: string;
  directories: DirectoryInfo[];
  keyFiles: KeyFileInfo[];
  undocumented: string[];
  removed: string[];
  duplicates: DuplicateReport | null;
}

interface KeyFileInfo {
  path: string;
  type: string;
}

/**
 * Parse a mapignore file into a Set of patterns.
 * Blank lines and lines starting with # are skipped.
 */
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

/**
 * Parse a mapkeys file into a Record<filename, type>.
 * Format: filename = type
 * Blank lines and lines starting with # are skipped.
 */
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

/**
 * Load config from project-level file, falling back to bundled template.
 */
async function loadConfigFile(
  root: string,
  filename: string
): Promise<string> {
  // Project-level override: .grimoire/<filename>
  const projectPath = join(root, ".grimoire", filename);
  try {
    return await readFile(projectPath, "utf-8");
  } catch {
    // Fall back to bundled template
    const templatePath = join(PACKAGE_ROOT, "templates", filename);
    return await readFile(templatePath, "utf-8");
  }
}

export async function generateMap(options: MapOptions): Promise<void> {
  const root = await findProjectRoot();
  const docsDir = join(root, ".grimoire", "docs");

  // Load config files
  const ignoreContent = await loadConfigFile(root, "mapignore");
  const keysContent = await loadConfigFile(root, "mapkeys");
  const ignorePatterns = parseIgnoreFile(ignoreContent);
  const keyFilePatterns = parseKeyFilesConfig(keysContent);

  // Scan the directory tree
  const directories: DirectoryInfo[] = [];
  const keyFiles: KeyFileInfo[] = [];

  await scanDirectory(
    root,
    root,
    0,
    options.maxDepth,
    directories,
    keyFiles,
    ignorePatterns,
    keyFilePatterns
  );

  // Load existing index if refreshing
  let existingAreas: string[] = [];
  if (options.refresh) {
    existingAreas = await loadExistingAreas(docsDir);
  }

  // Determine what's undocumented and what's been removed
  const scannedDirs = new Set(directories.map((d) => d.path));
  const undocumented = directories
    .filter((d) => !existingAreas.includes(d.path))
    .filter((d) => d.fileCount > 0)
    .map((d) => d.path);
  const removed = existingAreas.filter((a) => !scannedDirs.has(a));

  // Run duplicate detection if requested
  let duplicates: DuplicateReport | null = null;
  if (options.duplicates) {
    duplicates = await runJscpd(root, ignorePatterns);
  }

  const snapshot: MapSnapshot = {
    generatedAt: new Date().toISOString(),
    projectRoot: ".",
    directories,
    keyFiles,
    undocumented,
    removed,
    duplicates,
  };

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  // Pretty print
  console.log(chalk.bold("\nProject Map\n"));

  // Directory tree
  console.log(chalk.bold("Structure:"));
  for (const dir of directories) {
    const depth = dir.path === "." ? 0 : dir.path.split("/").length;
    const padding = "  ".repeat(depth);
    const extSummary = Object.entries(dir.extensions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([ext, count]) => `${count} ${ext}`)
      .join(", ");

    const keyFileNote =
      dir.keyFiles.length > 0
        ? chalk.dim(` [${dir.keyFiles.join(", ")}]`)
        : "";

    console.log(
      `${padding}${chalk.cyan(dir.path + "/")} ${chalk.dim(extSummary)}${keyFileNote}`
    );
  }

  // Key files
  if (keyFiles.length > 0) {
    console.log(chalk.bold("\nKey Files:"));
    for (const kf of keyFiles) {
      console.log(`  ${kf.path} ${chalk.dim(`(${kf.type})`)}`);
    }
  }

  // Duplicate report
  if (duplicates) {
    if (duplicates.clones.length > 0) {
      console.log(
        chalk.bold.yellow(
          `\nDuplicates: ${duplicates.clones.length} clone(s), ${duplicates.totalDuplicatedLines} duplicated lines (${duplicates.percentDuplicated.toFixed(1)}%)\n`
        )
      );
      for (const clone of duplicates.clones.slice(0, 10)) {
        console.log(
          `  ${chalk.dim(clone.firstFile)}:${clone.firstStartLine}-${clone.firstEndLine}`
        );
        console.log(
          `  ${chalk.dim(clone.secondFile)}:${clone.secondStartLine}-${clone.secondEndLine}`
        );
        console.log(
          `  ${chalk.dim(`${clone.lines} lines, ${clone.tokens} tokens`)}\n`
        );
      }
      if (duplicates.clones.length > 10) {
        console.log(
          chalk.dim(
            `  ... and ${duplicates.clones.length - 10} more (see .snapshot.json for full list)`
          )
        );
      }
    } else {
      console.log(chalk.green("\nNo duplicates detected."));
    }
  }

  // Diff against existing docs
  if (options.refresh) {
    if (undocumented.length > 0) {
      console.log(chalk.bold.yellow("\nUndocumented areas:"));
      for (const u of undocumented) {
        console.log(`  ${chalk.yellow("+")} ${u}/`);
      }
    }

    if (removed.length > 0) {
      console.log(chalk.bold.red("\nRemoved (docs may be stale):"));
      for (const r of removed) {
        console.log(`  ${chalk.red("-")} ${r}/`);
      }
    }

    if (undocumented.length === 0 && removed.length === 0) {
      console.log(
        chalk.green("\nAll areas are documented. No changes detected.")
      );
    }
  } else {
    console.log(
      chalk.dim(
        `\n${directories.length} directories, ${keyFiles.length} key files found.`
      )
    );
    console.log(
      chalk.dim(
        "Run /grimoire:discover to generate area docs from this snapshot."
      )
    );
  }

  // Write snapshot for the skill to consume
  await mkdir(docsDir, { recursive: true });
  await writeFile(
    join(docsDir, ".snapshot.json"),
    JSON.stringify(snapshot, null, 2)
  );
  console.log(
    chalk.dim(`\nSnapshot saved to .grimoire/docs/.snapshot.json`)
  );
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
  const dirName = basename(fullPath);

  // Skip ignored directories (by name match)
  if (depth > 0 && ignorePatterns.has(dirName)) return;
  // Skip hidden dirs except .grimoire
  if (depth > 0 && dirName.startsWith(".") && dirName !== ".grimoire") return;

  let entries;
  try {
    entries = await readdir(fullPath, { withFileTypes: true });
  } catch {
    return;
  }

  const files = entries.filter((e) => e.isFile());
  const subdirs = entries
    .filter((e) => e.isDirectory())
    .filter((e) => !ignorePatterns.has(e.name))
    .filter((e) => !e.name.startsWith(".") || e.name === ".grimoire");

  // Count extensions and detect key files
  const extensions: Record<string, number> = {};
  const dirKeyFiles: string[] = [];

  for (const file of files) {
    const ext = extname(file.name) || file.name;
    extensions[ext] = (extensions[ext] || 0) + 1;

    if (keyFilePatterns[file.name]) {
      const kfPath = relPath === "." ? file.name : `${relPath}/${file.name}`;
      keyFiles.push({
        path: kfPath,
        type: keyFilePatterns[file.name],
      });
      dirKeyFiles.push(file.name);
    }
  }

  // Include directories that have files or are shallow enough to show structure
  if (files.length > 0 || depth <= 1) {
    directories.push({
      path: relPath === "." ? "." : relPath,
      fileCount: files.length,
      extensions,
      keyFiles: dirKeyFiles,
      subdirs: subdirs.map((s) => s.name),
    });
  }

  for (const subdir of subdirs) {
    await scanDirectory(
      join(fullPath, subdir.name),
      root,
      depth + 1,
      maxDepth,
      directories,
      keyFiles,
      ignorePatterns,
      keyFilePatterns
    );
  }
}

async function runJscpd(
  root: string,
  ignorePatterns: Set<string>
): Promise<DuplicateReport | null> {
  // Check if jscpd is available
  try {
    await execFileAsync("npx", ["jscpd", "--version"], { cwd: root });
  } catch {
    console.log(
      chalk.yellow(
        "\njscpd not found. Install with: npm install -g jscpd"
      )
    );
    console.log(
      chalk.yellow("Skipping duplicate detection.\n")
    );
    return null;
  }

  console.log(chalk.dim("\nRunning jscpd duplicate detection..."));

  try {
    // Build ignore pattern for jscpd
    const ignoreArg = [...ignorePatterns]
      .map((p) => `**/${p}/**`)
      .join(",");

    const args = [
      "jscpd",
      root,
      "--reporters", "json",
      "--output", join(root, ".grimoire", "docs"),
      "--silent",
    ];

    if (ignoreArg) {
      args.push("--ignore", ignoreArg);
    }

    await execFileAsync("npx", args, {
      cwd: root,
      timeout: 60_000,
    });

    // Read the jscpd JSON report
    const reportPath = join(root, ".grimoire", "docs", "jscpd-report.json");
    const reportContent = await readFile(reportPath, "utf-8");
    const report = JSON.parse(reportContent);

    const clones: CloneInfo[] = (report.duplicates || []).map(
      (d: Record<string, unknown>) => {
        const first = d.firstFile as Record<string, unknown>;
        const second = d.secondFile as Record<string, unknown>;
        return {
          firstFile: relative(root, first.name as string),
          firstStartLine: (first.startLoc as Record<string, number>)?.line ?? 0,
          firstEndLine: (first.endLoc as Record<string, number>)?.line ?? 0,
          secondFile: relative(root, second.name as string),
          secondStartLine: (second.startLoc as Record<string, number>)?.line ?? 0,
          secondEndLine: (second.endLoc as Record<string, number>)?.line ?? 0,
          lines: (d.lines as number) || 0,
          tokens: (d.tokens as number) || 0,
          fragment: ((d.fragment as string) || "").slice(0, 200),
        };
      }
    );

    const stats = report.statistics as Record<string, unknown> | undefined;
    const totalLines = (stats?.total as Record<string, number>)?.lines || 1;
    const dupLines = (stats?.total as Record<string, number>)?.duplicatedLines || 0;

    return {
      clones,
      totalDuplicatedLines: dupLines,
      percentDuplicated: (dupLines / totalLines) * 100,
    };
  } catch (err) {
    console.log(
      chalk.yellow(
        `\njscpd failed: ${err instanceof Error ? err.message : "unknown error"}`
      )
    );
    return null;
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
