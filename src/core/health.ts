import { readdir, readFile, writeFile, access } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { parse as parseYaml } from "yaml";
import { matter } from "../utils/frontmatter.js";
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
  items?: SpecDriftItem[];
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
  const [features, decisions, areaDocs, dataSchema, conventionsDrift, specDrift, testCoverage, unitCoverage, duplicates, complexity] =
    await Promise.all([
      checkFeatures(root),
      checkDecisions(root),
      checkAreaDocs(root),
      checkDataSchema(root),
      checkConventionsDrift(root),
      checkSpecDrift(root),
      checkTestCoverage(root),
      checkUnitTestCoverage(root, config),
      checkDuplicates(root, config),
      checkComplexity(root, config),
    ]);

  metrics.push(features, decisions, areaDocs, dataSchema, conventionsDrift, specDrift, testCoverage, unitCoverage, duplicates, complexity);

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

  // Report scenario presence, not pass/fail — running tests is `grimoire check`.
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
    if (!status.includes("superseded")) {
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
  // Count documented areas in the index — the intent grimoire owns. Live
  // structure (which areas exist) comes from codebase-memory-mcp, not here.
  const indexPath = join(root, ".grimoire", "docs", "index.yml");

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
      label: "no area docs (run grimoire discover)",
    };
  }

  return {
    name: "area_docs",
    score: documented > 0 ? 100 : 0,
    label: `${documented} area${documented !== 1 ? "s" : ""} documented`,
  };
}

// --- Conventions drift ---
// Ported from the retired `grimoire map` command. Checks that path rules
// written in conventions docs still point at directories that exist.

interface DriftItem {
  conventionsFile: string;
  path: string;
  context: string;
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

async function detectConventionsDrift(root: string): Promise<DriftItem[] | null> {
  const conventionsDir = join(root, ".grimoire", "docs", "conventions");

  let files: string[];
  try {
    const entries = await readdir(conventionsDir);
    files = entries.filter((f) => f.endsWith(".md"));
  } catch {
    return null;
  }

  if (files.length === 0) return null;

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

async function checkConventionsDrift(root: string): Promise<Metric> {
  const drift = await detectConventionsDrift(root);

  if (drift === null) {
    return { name: "conventions_drift", score: null, label: "no conventions docs" };
  }
  if (drift.length === 0) {
    return { name: "conventions_drift", score: 100, label: "no drift — paths match" };
  }
  return {
    name: "conventions_drift",
    score: 0,
    label: `${drift.length} stale path${drift.length !== 1 ? "s" : ""}`,
    detail: drift.map((d) => `${d.conventionsFile}: ${d.path}`).join("; "),
  };
}

// --- Spec-process drift ---
// Mechanical repo-wide checks: stale change folders, unproven constraint rows,
// decision supersession integrity, decision references in code, broken doc links, archive trees.

type DriftSeverity = "fix-now" | "review" | "info";

interface SpecDriftItem {
  severity: DriftSeverity;
  message: string;
  action: string;
}

const STALE_DAYS = 30;

async function checkSpecDrift(root: string): Promise<Metric> {
  const trailers = await mainChangeTrailers(root);
  const groups = await Promise.all([
    findStaleChanges(root, trailers?.ids ?? new Set<string>()),
    findUnprovenConstraints(root),
    findSupersessionIssues(root),
    findDecisionReferences(root),
    findBrokenDocLinks(root),
    findArchiveTrees(root),
  ]);
  const items = groups.flat();

  if (trailers && trailers.total > 0) {
    const pct = Math.round((trailers.withTrailer / trailers.total) * 100);
    items.push({
      severity: "info",
      message: `Change: trailer coverage on main: ${pct}%`,
      action: "carry the Change: trailer on every commit",
    });
  }

  const actionable = items.filter((i) => i.severity !== "info").length;
  return {
    name: "spec_drift",
    score: null, // informational
    label:
      actionable === 0
        ? "no spec-process drift"
        : `${actionable} drift item${actionable !== 1 ? "s" : ""}`,
    items,
  };
}

async function mainChangeTrailers(
  root: string
): Promise<{ ids: Set<string>; total: number; withTrailer: number } | null> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      "git",
      ["log", "main", "--format=%H%x09%(trailers:key=Change,valueonly,separator=%x2C)"],
      { cwd: root, timeout: 30_000 }
    ));
  } catch {
    return null;
  }

  const ids = new Set<string>();
  let total = 0;
  let withTrailer = 0;
  for (const line of stdout.split("\n").filter(Boolean)) {
    total++;
    const value = line.split("\t")[1]?.trim();
    if (!value) continue;
    withTrailer++;
    for (const id of value.split(",")) ids.add(id.trim());
  }
  return { ids, total, withTrailer };
}

async function findStaleChanges(root: string, merged: Set<string>): Promise<SpecDriftItem[]> {
  const changesDir = join(root, ".grimoire", "changes");
  let entries: string[];
  try {
    entries = await readdir(changesDir);
  } catch {
    return [];
  }

  const items: SpecDriftItem[] = [];
  for (const id of entries) {
    const manifest = await readFileOrNull(join(changesDir, id, "manifest.md"));
    if (!manifest) continue;

    if (merged.has(id)) {
      items.push({
        severity: "fix-now",
        message: `change ${id} is merged on main but its folder remains`,
        action: `remove .grimoire/changes/${id}/`,
      });
      continue;
    }

    const stalled = await stalledItem(root, id);
    if (stalled) items.push(stalled);
  }
  return items;
}

async function stalledItem(root: string, id: string): Promise<SpecDriftItem | null> {
  const folder = `.grimoire/changes/${id}`;
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      "git",
      ["log", "-1", "--format=%ct", "--", `${folder}/`],
      { cwd: root, timeout: 30_000 }
    ));
  } catch {
    return null;
  }
  const timestamp = parseInt(stdout.trim(), 10);
  if (!Number.isFinite(timestamp)) return null;
  const ageDays = Math.floor((Date.now() - timestamp * 1000) / 86_400_000);
  if (ageDays <= STALE_DAYS) return null;

  const tasks = await readFileOrNull(join(root, folder, "tasks.md"));
  const done = tasks?.match(/^\s*- \[x\]/gim)?.length ?? 0;
  if (done > 0) return null;
  return {
    severity: "review",
    message: `change ${id} stalled — last touched ${ageDays} days ago with no tasks done`,
    action: "re-triage the change or remove its folder",
  };
}

async function findUnprovenConstraints(root: string): Promise<SpecDriftItem[]> {
  const content = await readFileOrNull(join(root, ".grimoire", "docs", "constraints.md"));
  if (!content) return [];

  const items: SpecDriftItem[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || /^[|\s-]+$/.test(trimmed)) continue;
    const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3 || cells[0].toLowerCase().startsWith("constraint")) continue;

    if (/\bTODO\b/.test(cells[2])) {
      items.push({
        severity: "fix-now",
        message: `constraints.md: "${cells[0]}" — verification cell is TODO`,
        action: "add the proving test or remove the row",
      });
      continue;
    }
    items.push(...(await staleCitations(root, cells[0], cells[2])));
  }
  return items;
}

async function staleCitations(
  root: string,
  constraint: string,
  cell: string
): Promise<SpecDriftItem[]> {
  const items: SpecDriftItem[] = [];
  for (const [, token] of cell.matchAll(/`([^`]+)`/g)) {
    let found: boolean | null;
    if (token.includes("/")) {
      const resolved = resolve(join(root, token));
      found = resolved.startsWith(root + "/") ? await pathExists(resolved) : null;
    } else {
      found = await grepHits(root, token);
    }
    if (found === false) {
      items.push({
        severity: "fix-now",
        message: `constraints.md: "${constraint}" cites \`${token}\`, which was not found`,
        action: "update or remove the stale citation",
      });
    }
  }
  return items;
}

async function grepHits(root: string, text: string): Promise<boolean | null> {
  if (text.includes(".") && (await fileWithBasename(root, text))) return true;
  try {
    await execFileAsync(
      "git",
      ["grep", "-I", "-l", "-F", "-e", text, "--", ".", ":!.grimoire"],
      { cwd: root, timeout: 30_000 }
    );
    return true;
  } catch (err) {
    return (err as { code?: number }).code === 1 ? false : null;
  }
}

async function fileWithBasename(root: string, name: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "--", name, `*/${name}`],
      { cwd: root, timeout: 30_000 }
    );
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function findSupersessionIssues(root: string): Promise<SpecDriftItem[]> {
  const dir = join(root, ".grimoire", "decisions");
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".md") && f !== "template.md");
  } catch {
    return [];
  }

  const decisions = new Map<string, string>();
  for (const file of files) {
    const content = await readFileOrNull(join(dir, file));
    if (content) decisions.set(file, content);
  }

  const items: SpecDriftItem[] = [];
  for (const [file, content] of decisions) {
    const status = String(matter(content).data.status ?? "");
    const supersession = status.match(/^superseded by\s+(\d+)$/i);
    if (!supersession) continue;

    const replacementNumber = supersession[1].padStart(4, "0");
    const replacement = [...decisions.keys()].find((name) => name.startsWith(`${replacementNumber}-`));
    if (!replacement) {
      items.push({
        severity: "review",
        message: `${file}: replacement decision ${replacementNumber} is missing`,
        action: "restore the replacement decision or correct the superseded status",
      });
      continue;
    }

    const sourceNumber = file.slice(0, file.indexOf("-"));
    const replacementContent = decisions.get(replacement)!;
    if (!new RegExp(`(?:supersed(?:es|ing)|replac(?:es|ing))[^\\n]*\\b${sourceNumber}\\b`, "i").test(replacementContent)) {
      items.push({
        severity: "review",
        message: `${replacement}: missing backlink to superseded decision ${sourceNumber}`,
        action: `add the supersession backlink to ${replacement}`,
      });
    }
  }
  return items;
}

async function findDecisionReferences(root: string): Promise<SpecDriftItem[]> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      "git",
      [
        "grep", "-I", "-n", "-E", "ADR-[0-9]|decisions/0",
        "--", ".", ":!.grimoire/decisions", ":!.grimoire/changes",
      ],
      { cwd: root, timeout: 30_000 }
    ));
  } catch {
    return [];
  }

  const items: SpecDriftItem[] = [];
  const generated = new Map<string, boolean>();
  for (const line of stdout.split("\n").filter(Boolean)) {
    const path = line.split(":")[0];
    if (!sweptPath(path)) continue;
    if (!generated.has(path)) generated.set(path, await isAutoGenerated(root, path));
    if (generated.get(path)) continue;
    items.push({
      severity: "review",
      message: `decision reference in ${line.trim()}`,
      action: "make the comment or doc self-contained",
    });
  }
  return items;
}

// The sweep targets hand-written code comments and grimoire docs; test
// fixtures, instructional material, and meta-docs cite decisions legitimately.
function sweptPath(path: string): boolean {
  if (/\.(test|spec)\./.test(path) || path.startsWith("features/steps/")) return false;
  if (/^(notes|templates)\//.test(path) || /(^|\/)skills\//.test(path)) return false;
  if (/(^|\/)(archive|backup)s?\//i.test(path)) return false;
  if (/^(README|CONTRIBUTING|AGENTS|CLAUDE)\.md$/i.test(path)) return false;
  if (path.endsWith("OVERVIEW.md")) return false;
  return true;
}

async function isAutoGenerated(root: string, path: string): Promise<boolean> {
  const content = await readFileOrNull(join(root, path));
  if (!content) return false;
  return /auto-generated/i.test(content.split("\n").slice(0, 4).join("\n"));
}

async function findBrokenDocLinks(root: string): Promise<SpecDriftItem[]> {
  const docsDir = join(root, ".grimoire", "docs");
  let files: string[];
  try {
    files = (await readdir(docsDir)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }

  const items: SpecDriftItem[] = [];
  for (const file of files) {
    const content = await readFileOrNull(join(docsDir, file));
    if (!content) continue;
    for (const [, target] of content.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const path = resolve(docsDir, target.split("#")[0]);
      if (!path.startsWith(root + "/")) continue;
      if (!(await pathExists(path))) {
        items.push({
          severity: "review",
          message: `${file}: broken link to ${target}`,
          action: "fix or remove the link",
        });
      }
    }
  }
  return items;
}

async function findArchiveTrees(root: string): Promise<SpecDriftItem[]> {
  let entries: string[];
  try {
    entries = await readdir(join(root, ".grimoire"));
  } catch {
    return [];
  }
  return entries
    .filter((e) => /archive|backup/i.test(e))
    .map((e) => ({
      severity: "review" as const,
      message: `.grimoire/${e}/ looks like an archive tree`,
      action: "delete it; git history is the record",
    }));
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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

async function readCoverageFromFiles(
  coveragePaths: string[],
  root: string,
): Promise<Metric | null> {
  for (const coveragePath of coveragePaths) {
    try {
      const data = JSON.parse(await readFile(coveragePath, "utf-8"));
      if (data.total?.lines?.pct !== undefined) {
        const pct = Math.round(data.total.lines.pct);
        return { name: "unit_coverage", score: pct, label: `${pct}% line coverage`, detail: relative(root, coveragePath) };
      }
      if (data.totals?.percent_covered !== undefined) {
        const pct = Math.round(data.totals.percent_covered);
        return { name: "unit_coverage", score: pct, label: `${pct}% line coverage`, detail: relative(root, coveragePath) };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function runCoverageCommand(
  unitTool: { name: string; command?: string },
  config: Awaited<ReturnType<typeof loadConfig>>,
  root: string,
): Promise<Metric | null> {
  const coverageCmd = detectCoverageCommand(unitTool, config);
  if (!coverageCmd) return null;
  try {
    const { stdout } = await execFileAsync("sh", ["-c", coverageCmd], { cwd: root, timeout: 120_000 });
    const pctMatch = stdout.match(/(?:total|overall|TOTAL)[^\d]*(\d+(?:\.\d+)?)\s*%/i);
    if (pctMatch) {
      const pct = Math.round(parseFloat(pctMatch[1]));
      return { name: "unit_coverage", score: pct, label: `${pct}% line coverage` };
    }
  } catch {
    // Coverage command failed
  }
  return null;
}

async function checkUnitTestCoverage(
  root: string,
  config: Awaited<ReturnType<typeof loadConfig>>
): Promise<Metric> {
  const coveragePaths = [
    join(root, "coverage", "coverage-summary.json"),
    join(root, "htmlcov", "status.json"),
    join(root, ".coverage.json"),
    join(root, "coverage.json"),
  ];

  const fromFiles = await readCoverageFromFiles(coveragePaths, root);
  if (fromFiles) return fromFiles;

  const unitTool = config.tools.unit_test;
  if (unitTool?.command) {
    const fromCommand = await runCoverageCommand(unitTool, config, root);
    if (fromCommand) return fromCommand;
  }

  return { name: "unit_coverage", score: null, label: "no coverage data (run tests with --coverage)" };
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

    for (const item of m.items ?? []) {
      const sev = severityColor(item.severity)(item.severity.padEnd(7));
      console.log(`    ${sev}  ${item.message} — ${item.action}`);
    }
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

function severityColor(severity: DriftSeverity): typeof chalk.green {
  if (severity === "fix-now") return chalk.red;
  if (severity === "review") return chalk.yellow;
  return chalk.dim;
}

// --- Badges ---

function badgeColor(score: number): string {
  return score >= 80 ? "green" : score >= 60 ? "yellow" : "red";
}

function buildBadgeList(metrics: HealthResult["metrics"], overall: number): string[] {
  const badges: string[] = [];
  for (const m of metrics) {
    if (m.score === null) continue;
    badges.push(`![${m.name}](https://img.shields.io/badge/${m.name.replace(/_/g, "%20")}-${encodeURIComponent(`${m.score}%`)}-${badgeColor(m.score)})`);
  }
  for (const m of metrics) {
    if (m.score !== null || m.label === "not configured" || m.label.includes("not available")) continue;
    badges.push(`![${m.name}](https://img.shields.io/badge/${m.name.replace(/_/g, "%20")}-${encodeURIComponent(m.label)}-blue)`);
  }
  badges.push(`![health](https://img.shields.io/badge/grimoire%20health-${overall}%25-${badgeColor(overall)})`);
  return badges;
}

async function writeBadges(
  root: string,
  filePath: string,
  result: HealthResult
): Promise<void> {
  const target = safePath(root, filePath);
  const marker = "<!-- GRIMOIRE:HEALTH:START -->";
  const endMarker = "<!-- GRIMOIRE:HEALTH:END -->";

  const badges = buildBadgeList(result.metrics, result.overall);
  const badgeBlock = `${marker}\n${badges.join("\n")}\n${endMarker}`;

  let content: string;
  try {
    content = await readFile(target, "utf-8");
  } catch {
    await writeFile(target, badgeBlock + "\n");
    console.log(chalk.green("Created") + ` ${filePath} with health badges`);
    return;
  }

  if (content.includes(marker)) {
    const updated = content.replace(
      new RegExp(`${escapeRegex(marker)}[\\s\\S]*?${escapeRegex(endMarker)}`),
      badgeBlock
    );
    await writeFile(target, updated);
    console.log(chalk.blue("Updated") + ` ${filePath} health badges`);
  } else {
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
