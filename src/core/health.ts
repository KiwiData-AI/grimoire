import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { parse as parseYaml } from "yaml";
import matter from "gray-matter";
import { findProjectRoot, safePath } from "../utils/paths.js";
import { loadConfig } from "../utils/config.js";
import { readFileOrNull, escapeRegex, findFiles } from "../utils/fs.js";

const execFileAsync = promisify(execFile);

interface HealthOptions {
  json: boolean;
  badges?: string; // file path to write badges into
}

interface Metric {
  name: string;
  score: number | null; // 0-100, null = informational
  label: string; // human-readable status
  detail?: string;
}

interface HealthResult {
  metrics: Metric[];
  overall: number;
}

export async function runHealth(options: HealthOptions): Promise<void> {
  const root = await findProjectRoot();
  const config = await loadConfig(root);

  const metrics: Metric[] = [];

  // Run all checks in parallel where possible
  const [features, decisions, areaDocs, dataSchema, testCoverage, unitCoverage, duplicates, complexity] =
    await Promise.all([
      checkFeatures(root),
      checkDecisions(root),
      checkAreaDocs(root),
      checkDataSchema(root),
      checkTestCoverage(root),
      checkUnitTestCoverage(root, config),
      checkDuplicates(root, config),
      checkComplexity(root, config),
    ]);

  metrics.push(features, decisions, areaDocs, dataSchema, testCoverage, unitCoverage, duplicates, complexity);

  // Calculate overall (average of scored metrics)
  const scored = metrics.filter((m) => m.score !== null);
  const overall =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, m) => sum + m.score!, 0) / scored.length
        )
      : 0;

  const result: HealthResult = { metrics, overall };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHealth(result);
  }

  if (options.badges) {
    await writeBadges(root, options.badges, result);
  }
}

// --- Metrics ---

async function checkFeatures(root: string): Promise<Metric> {
  const featuresDir = join(root, "features");
  let featureFiles: string[];
  try {
    featureFiles = await findFiles(featuresDir, ".feature");
  } catch {
    return { name: "features", score: null, label: "no features/" };
  }

  if (featureFiles.length === 0) {
    return { name: "features", score: null, label: "no features found" };
  }

  let totalScenarios = 0;
  for (const file of featureFiles) {
    const content = await readFileOrNull(file);
    if (!content) continue;
    const scenarios = content.match(/^\s*Scenario(?: Outline)?:/gm);
    totalScenarios += scenarios?.length ?? 0;
  }

  // We can't run tests here (that's what grimoire check does),
  // so we report scenario count. Score based on having scenarios at all.
  const hasScenarios = totalScenarios > 0;
  return {
    name: "features",
    score: hasScenarios ? 100 : 0,
    label: `${totalScenarios} scenario${totalScenarios !== 1 ? "s" : ""} in ${featureFiles.length} file${featureFiles.length !== 1 ? "s" : ""}`,
  };
}

async function checkDecisions(root: string): Promise<Metric> {
  const decisionsDir = join(root, ".grimoire", "decisions");
  let files: string[];
  try {
    const entries = await readdir(decisionsDir);
    files = entries.filter(
      (f) => f.endsWith(".md") && f !== "template.md"
    );
  } catch {
    return { name: "decisions", score: null, label: "no decisions/" };
  }

  if (files.length === 0) {
    return { name: "decisions", score: null, label: "no decisions found" };
  }

  let current = 0;
  let total = 0;
  for (const file of files) {
    const content = await readFileOrNull(join(decisionsDir, file));
    if (!content) continue;
    total++;

    const { data: fm } = matter(content);
    const status = fm.status ? String(fm.status).trim() : "";
    if (!status || status === "accepted" || status === "proposed" || !status.includes("superseded")) {
      current++;
    }
  }

  const score = total > 0 ? Math.round((current / total) * 100) : 0;
  return {
    name: "decisions",
    score,
    label: `${current}/${total} current`,
  };
}

async function checkAreaDocs(root: string): Promise<Metric> {
  const indexPath = join(root, ".grimoire", "docs", "index.yml");
  const snapshotPath = join(root, ".grimoire", "docs", ".snapshot.json");

  let documented = 0;
  try {
    const indexContent = await readFile(indexPath, "utf-8");
    const index = parseYaml(indexContent) as {
      areas?: Array<Record<string, string>>;
    };
    documented = index?.areas?.length ?? 0;
  } catch {
    return {
      name: "area_docs",
      score: 0,
      label: "no area docs (run grimoire map + discover)",
    };
  }

  // Count total areas from snapshot
  let totalAreas = documented;
  try {
    const snapshotContent = await readFile(snapshotPath, "utf-8");
    const snapshot = JSON.parse(snapshotContent) as {
      directories?: Record<string, unknown>;
    };
    if (snapshot.directories) {
      // Count top-level directories as areas
      totalAreas = Math.max(
        Object.keys(snapshot.directories).length,
        documented
      );
    }
  } catch {
    // No snapshot — use documented count as total
  }

  const score =
    totalAreas > 0 ? Math.round((documented / totalAreas) * 100) : 0;
  return {
    name: "area_docs",
    score,
    label: `${documented}/${totalAreas} areas documented`,
  };
}

async function checkDataSchema(root: string): Promise<Metric> {
  const schemaPath = join(
    root,
    ".grimoire",
    "docs",
    "data",
    "schema.yml"
  );

  let schemaContent: string;
  try {
    schemaContent = await readFile(schemaPath, "utf-8");
  } catch {
    return {
      name: "data_schema",
      score: null,
      label: "no schema.yml",
    };
  }

  const schema = parseYaml(schemaContent) as Record<string, unknown>;
  if (!schema) {
    return { name: "data_schema", score: null, label: "empty schema" };
  }

  const modelCount = Object.keys(schema).length;
  // If schema exists and has models, it's documented
  return {
    name: "data_schema",
    score: modelCount > 0 ? 100 : 0,
    label: `${modelCount} model${modelCount !== 1 ? "s" : ""} documented`,
  };
}

async function checkTestCoverage(root: string): Promise<Metric> {
  const featuresDir = join(root, "features");

  let featureFiles: string[];
  try {
    featureFiles = await findFiles(featuresDir, ".feature");
  } catch {
    return { name: "test_coverage", score: null, label: "no features/" };
  }

  if (featureFiles.length === 0) {
    return { name: "test_coverage", score: null, label: "no features" };
  }

  // For each feature file, check if step definitions exist somewhere
  // Look for step_defs/, steps/, step_definitions/ directories
  let withSteps = 0;
  const stepDirs = await findStepDirectories(root);

  if (stepDirs.length === 0) {
    return {
      name: "test_coverage",
      score: 0,
      label: `0/${featureFiles.length} features have step definitions`,
      detail: "No step definition directories found",
    };
  }

  // Read all step definition content for matching
  const allStepContent = await readAllFiles(stepDirs);

  for (const file of featureFiles) {
    const content = await readFileOrNull(file);
    if (!content) continue;

    // Extract scenario names and step text
    const steps = content.match(
      /^\s+(?:Given|When|Then|And|But)\s+(.+)$/gm
    );
    if (!steps || steps.length === 0) continue;

    // Check if any step text appears in step definitions (loose match)
    const hasSteps = steps.some((step) => {
      const text = step.replace(/^\s+(?:Given|When|Then|And|But)\s+/, "");
      // Check for step text or key words from it in step defs
      const keywords = text
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 3);
      return keywords.some((kw) =>
        allStepContent.some((sc) => sc.includes(kw))
      );
    });

    if (hasSteps) withSteps++;
  }

  const score =
    featureFiles.length > 0
      ? Math.round((withSteps / featureFiles.length) * 100)
      : 0;
  return {
    name: "test_coverage",
    score,
    label: `${withSteps}/${featureFiles.length} features have step definitions`,
  };
}

async function checkUnitTestCoverage(
  root: string,
  config: Awaited<ReturnType<typeof loadConfig>>
): Promise<Metric> {
  // Try to get coverage from common coverage report locations
  const coveragePaths = [
    join(root, "coverage", "coverage-summary.json"), // jest/vitest
    join(root, "htmlcov", "status.json"), // pytest-cov
    join(root, ".coverage.json"), // custom
    join(root, "coverage.json"),
  ];

  for (const coveragePath of coveragePaths) {
    try {
      const content = await readFile(coveragePath, "utf-8");
      const data = JSON.parse(content);

      // jest/vitest format
      if (data.total?.lines?.pct !== undefined) {
        const pct = Math.round(data.total.lines.pct);
        return {
          name: "unit_coverage",
          score: pct,
          label: `${pct}% line coverage`,
          detail: relative(root, coveragePath),
        };
      }

      // pytest-cov JSON format
      if (data.totals?.percent_covered !== undefined) {
        const pct = Math.round(data.totals.percent_covered);
        return {
          name: "unit_coverage",
          score: pct,
          label: `${pct}% line coverage`,
          detail: relative(root, coveragePath),
        };
      }
    } catch {
      continue;
    }
  }

  // Try running coverage command if configured
  const unitTool = config.tools.unit_test;
  if (unitTool?.command) {
    // Try common coverage flags
    const coverageCommands = detectCoverageCommand(unitTool, config);
    if (coverageCommands) {
      try {
        const { stdout } = await execFileAsync(
          "sh",
          ["-c", coverageCommands],
          { cwd: root, timeout: 120_000 }
        );

        // Parse percentage from output (most tools print "XX%" or "XX.X%")
        const pctMatch = stdout.match(
          /(?:total|overall|TOTAL)[^\d]*(\d+(?:\.\d+)?)\s*%/i
        );
        if (pctMatch) {
          const pct = Math.round(parseFloat(pctMatch[1]));
          return {
            name: "unit_coverage",
            score: pct,
            label: `${pct}% line coverage`,
          };
        }
      } catch {
        // Coverage command failed
      }
    }
  }

  return {
    name: "unit_coverage",
    score: null,
    label: "no coverage data (run tests with --coverage)",
  };
}

function detectCoverageCommand(
  unitTool: { name: string; command?: string },
  config: Awaited<ReturnType<typeof loadConfig>>
): string | null {
  const name = unitTool.name.toLowerCase();
  const lang = config.project.language?.toLowerCase() ?? "";

  if (name === "pytest" || lang === "python") {
    return `${unitTool.command ?? "pytest"} --cov --cov-report=term 2>/dev/null || true`;
  }
  if (name === "vitest") {
    return `npx vitest run --coverage --reporter=default 2>/dev/null || true`;
  }
  if (name === "jest") {
    return `npx jest --coverage --coverageReporters=text 2>/dev/null || true`;
  }
  if (name === "go" || lang === "go") {
    return `go test ./... -coverprofile=/dev/null -covermode=atomic 2>&1 | grep total || true`;
  }
  return null;
}

async function checkDuplicates(
  root: string,
  config: Awaited<ReturnType<typeof loadConfig>>
): Promise<Metric> {
  const tool = config.tools.duplicates;
  if (!tool?.command) {
    return {
      name: "duplicates",
      score: null,
      label: "not configured",
    };
  }

  try {
    const { stdout } = await execFileAsync(
      "sh",
      ["-c", tool.command],
      { cwd: root, timeout: 60_000 }
    );

    // jscpd typically reports "Found X clones"
    const cloneMatch = stdout.match(/Found\s+(\d+)\s+clone/i);
    const clones = cloneMatch ? parseInt(cloneMatch[1], 10) : 0;

    return {
      name: "duplicates",
      score: null, // informational
      label:
        clones === 0
          ? "no clones detected"
          : `${clones} clone${clones !== 1 ? "s" : ""} detected`,
    };
  } catch {
    return {
      name: "duplicates",
      score: null,
      label: "jscpd not available",
    };
  }
}

async function checkComplexity(
  root: string,
  config: Awaited<ReturnType<typeof loadConfig>>
): Promise<Metric> {
  const tool = config.tools.complexity;
  if (!tool?.command) {
    return {
      name: "complexity",
      score: null,
      label: "not configured",
    };
  }

  try {
    const { stdout } = await execFileAsync(
      "sh",
      ["-c", tool.command],
      { cwd: root, timeout: 60_000 }
    );

    // radon typically shows grade letters (A-F)
    const highComplexity = (
      stdout.match(/\b[D-F]\b/g) || []
    ).length;

    return {
      name: "complexity",
      score: null, // informational
      label:
        highComplexity === 0
          ? "no high-complexity functions"
          : `${highComplexity} function${highComplexity !== 1 ? "s" : ""} above threshold`,
    };
  } catch {
    return {
      name: "complexity",
      score: null,
      label: "tool not available",
    };
  }
}

// --- Output ---

function printHealth(result: HealthResult): void {
  console.log(chalk.bold("\ngrimoire health\n"));

  for (const m of result.metrics) {
    const name = m.name.replace(/_/g, " ").padEnd(16);
    const bar = m.score !== null ? renderBar(m.score) : "  ";
    const scoreText =
      m.score !== null ? `${String(m.score).padStart(3)}%` : "   —";
    const color = m.score !== null ? scoreColor(m.score) : chalk.dim;

    console.log(`  ${name} ${color(scoreText)}  ${bar}  ${m.label}`);
  }

  console.log();
  const overallColor = scoreColor(result.overall);
  console.log(
    `  ${chalk.bold("Overall")}          ${overallColor(chalk.bold(`${result.overall}%`))}  ${renderBar(result.overall)}`
  );
  console.log();
}

function renderBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  const color = scoreColor(score);
  return color("█".repeat(filled)) + chalk.dim("░".repeat(empty));
}

function scoreColor(score: number): typeof chalk.green {
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellow;
  return chalk.red;
}

// --- Badges ---

async function writeBadges(
  root: string,
  filePath: string,
  result: HealthResult
): Promise<void> {
  const target = safePath(root, filePath);
  const marker = "<!-- GRIMOIRE:HEALTH:START -->";
  const endMarker = "<!-- GRIMOIRE:HEALTH:END -->";

  const badges: string[] = [];
  for (const m of result.metrics) {
    if (m.score === null) continue;
    const color = m.score >= 80 ? "green" : m.score >= 60 ? "yellow" : "red";
    const label = m.name.replace(/_/g, "%20");
    const value = encodeURIComponent(`${m.score}%`);
    badges.push(
      `![${m.name}](https://img.shields.io/badge/${label}-${value}-${color})`
    );
  }

  // Add informational badges
  for (const m of result.metrics) {
    if (m.score !== null) continue;
    if (m.label === "not configured" || m.label.includes("not available"))
      continue;
    const label = m.name.replace(/_/g, "%20");
    const value = encodeURIComponent(m.label);
    badges.push(
      `![${m.name}](https://img.shields.io/badge/${label}-${value}-blue)`
    );
  }

  // Overall
  const overallColor =
    result.overall >= 80
      ? "green"
      : result.overall >= 60
        ? "yellow"
        : "red";
  badges.push(
    `![health](https://img.shields.io/badge/grimoire%20health-${result.overall}%25-${overallColor})`
  );

  const badgeBlock = `${marker}\n${badges.join("\n")}\n${endMarker}`;

  let content: string;
  try {
    content = await readFile(target, "utf-8");
  } catch {
    // File doesn't exist, create with just badges
    await writeFile(target, badgeBlock + "\n");
    console.log(chalk.green("Created") + ` ${filePath} with health badges`);
    return;
  }

  if (content.includes(marker)) {
    const updated = content.replace(
      new RegExp(
        `${escapeRegex(marker)}[\\s\\S]*?${escapeRegex(endMarker)}`
      ),
      badgeBlock
    );
    await writeFile(target, updated);
    console.log(chalk.blue("Updated") + ` ${filePath} health badges`);
  } else {
    // Prepend badges to file
    await writeFile(target, badgeBlock + "\n\n" + content);
    console.log(chalk.blue("Added") + ` health badges to ${filePath}`);
  }
}

// --- Helpers ---

async function findStepDirectories(root: string): Promise<string[]> {
  const candidates = [
    "features/steps",
    "features/step_definitions",
    "tests/step_defs",
    "tests/steps",
    "test/step_definitions",
    "test/steps",
    "e2e/steps",
    "e2e/step_definitions",
  ];

  const found: string[] = [];
  for (const candidate of candidates) {
    try {
      await readdir(join(root, candidate));
      found.push(join(root, candidate));
    } catch {
      // doesn't exist
    }
  }
  return found;
}

async function readAllFiles(dirs: string[]): Promise<string[]> {
  const contents: string[] = [];
  for (const dir of dirs) {
    try {
      const files = await findFiles(dir, "");
      for (const f of files) {
        const content = await readFileOrNull(f);
        if (content) contents.push(content);
      }
    } catch {
      // skip
    }
  }
  return contents;
}

