import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import chalk from "chalk";
import { findProjectRoot, resolveChangePath } from "../utils/paths.js";
import { findFiles, fileExists } from "../utils/fs.js";

interface ScenarioInfo {
  name: string;
  line: number;
}

interface FeatureDiff {
  file: string;
  status: "added" | "modified" | "removed";
  scenariosAdded: string[];
  scenariosRemoved: string[];
  scenariosUnchanged: string[];
}

export interface DiffResult {
  changeId: string;
  features: FeatureDiff[];
  decisions: { file: string; status: "added" | "modified" | "removed" }[];
  summary: {
    featuresAdded: number;
    featuresModified: number;
    featuresRemoved: number;
    scenariosAdded: number;
    scenariosRemoved: number;
    decisionsAdded: number;
    decisionsModified: number;
  };
}

export async function diffChange(
  changeId: string,
  options: { json: boolean }
): Promise<DiffResult> {
  const root = await findProjectRoot();
  const changePath = resolveChangePath(root, changeId);

  const features: FeatureDiff[] = [];
  const decisions: DiffResult["decisions"] = [];

  // Diff feature files
  const proposedFeaturesDir = join(changePath, "features");
  const baselineFeaturesDir = join(root, "features");

  try {
    const proposedFiles = await findFiles(proposedFeaturesDir, ".feature");

    for (const proposedFile of proposedFiles) {
      const relPath = relative(proposedFeaturesDir, proposedFile);
      const baselineFile = join(baselineFeaturesDir, relPath);

      const proposedContent = await readFile(proposedFile, "utf-8");
      const proposedScenarios = extractScenarios(proposedContent);

      if (await fileExists(baselineFile)) {
        const baselineContent = await readFile(baselineFile, "utf-8");
        const baselineScenarios = extractScenarios(baselineContent);

        const baselineNames = new Set(baselineScenarios.map((s) => s.name));
        const proposedNames = new Set(proposedScenarios.map((s) => s.name));

        const added = proposedScenarios
          .filter((s) => !baselineNames.has(s.name))
          .map((s) => s.name);
        const removed = baselineScenarios
          .filter((s) => !proposedNames.has(s.name))
          .map((s) => s.name);
        const unchanged = proposedScenarios
          .filter((s) => baselineNames.has(s.name))
          .map((s) => s.name);

        if (added.length > 0 || removed.length > 0) {
          features.push({
            file: relPath,
            status: "modified",
            scenariosAdded: added,
            scenariosRemoved: removed,
            scenariosUnchanged: unchanged,
          });
        }
      } else {
        features.push({
          file: relPath,
          status: "added",
          scenariosAdded: proposedScenarios.map((s) => s.name),
          scenariosRemoved: [],
          scenariosUnchanged: [],
        });
      }
    }
  } catch {
    // No proposed features directory
  }

  // Check for removed features referenced in manifest
  try {
    const manifestPath = join(changePath, "manifest.md");
    const manifest = await readFile(manifestPath, "utf-8");
    const removedMatches = manifest.matchAll(
      /\*\*REMOVED\*\*\s+`([^`]+\.feature)`/g
    );
    for (const match of removedMatches) {
      const relPath = match[1];
      const baselineFile = join(baselineFeaturesDir, relPath);
      if (await fileExists(baselineFile)) {
        const baselineContent = await readFile(baselineFile, "utf-8");
        const baselineScenarios = extractScenarios(baselineContent);
        features.push({
          file: relPath,
          status: "removed",
          scenariosAdded: [],
          scenariosRemoved: baselineScenarios.map((s) => s.name),
          scenariosUnchanged: [],
        });
      }
    }
  } catch {
    // No manifest or parse error
  }

  // Diff decision records
  const proposedDecisionsDir = join(changePath, "decisions");
  const baselineDecisionsDir = join(root, ".grimoire", "decisions");

  try {
    const proposedDecisionFiles = await findFiles(proposedDecisionsDir, ".md");

    for (const file of proposedDecisionFiles) {
      const relPath = relative(proposedDecisionsDir, file);
      const baselineFile = join(baselineDecisionsDir, relPath);

      if (await fileExists(baselineFile)) {
        decisions.push({ file: relPath, status: "modified" });
      } else {
        decisions.push({ file: relPath, status: "added" });
      }
    }
  } catch {
    // No proposed decisions directory
  }

  const result: DiffResult = {
    changeId,
    features,
    decisions,
    summary: {
      featuresAdded: features.filter((f) => f.status === "added").length,
      featuresModified: features.filter((f) => f.status === "modified").length,
      featuresRemoved: features.filter((f) => f.status === "removed").length,
      scenariosAdded: features.reduce(
        (sum, f) => sum + f.scenariosAdded.length,
        0
      ),
      scenariosRemoved: features.reduce(
        (sum, f) => sum + f.scenariosRemoved.length,
        0
      ),
      decisionsAdded: decisions.filter((d) => d.status === "added").length,
      decisionsModified: decisions.filter((d) => d.status === "modified")
        .length,
    },
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printDiff(result);
  }

  return result;
}

function extractScenarios(content: string): ScenarioInfo[] {
  const scenarios: ScenarioInfo[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s+Scenario(?: Outline)?:\s*(.+)/);
    if (match) {
      scenarios.push({ name: match[1].trim(), line: i + 1 });
    }
  }

  return scenarios;
}

function printDiff(result: DiffResult): void {
  console.log(chalk.bold(`\nSpec diff: ${result.changeId}\n`));

  if (result.features.length === 0 && result.decisions.length === 0) {
    console.log(chalk.dim("  No differences found."));
    return;
  }

  // Features
  for (const f of result.features) {
    const icon =
      f.status === "added"
        ? chalk.green("+")
        : f.status === "removed"
          ? chalk.red("-")
          : chalk.yellow("~");
    const label =
      f.status === "added"
        ? chalk.green("added")
        : f.status === "removed"
          ? chalk.red("removed")
          : chalk.yellow("modified");

    console.log(`  ${icon} ${chalk.bold(f.file)} ${chalk.dim(`[${label}]`)}`);

    for (const s of f.scenariosAdded) {
      console.log(`    ${chalk.green("+")} ${s}`);
    }
    for (const s of f.scenariosRemoved) {
      console.log(`    ${chalk.red("-")} ${s}`);
    }
    if (f.scenariosUnchanged.length > 0 && f.status === "modified") {
      console.log(
        chalk.dim(`    ${f.scenariosUnchanged.length} scenario(s) unchanged`)
      );
    }
  }

  // Decisions
  if (result.decisions.length > 0) {
    console.log();
    for (const d of result.decisions) {
      const icon =
        d.status === "added"
          ? chalk.green("+")
          : chalk.yellow("~");
      const label =
        d.status === "added"
          ? chalk.green("added")
          : chalk.yellow("modified");
      console.log(
        `  ${icon} ${chalk.bold(d.file)} ${chalk.dim(`[${label}]`)}`
      );
    }
  }

  // Summary line
  const parts: string[] = [];
  const s = result.summary;
  if (s.featuresAdded > 0) parts.push(chalk.green(`${s.featuresAdded} feature(s) added`));
  if (s.featuresModified > 0) parts.push(chalk.yellow(`${s.featuresModified} feature(s) modified`));
  if (s.featuresRemoved > 0) parts.push(chalk.red(`${s.featuresRemoved} feature(s) removed`));
  if (s.scenariosAdded > 0) parts.push(chalk.green(`${s.scenariosAdded} scenario(s) added`));
  if (s.scenariosRemoved > 0) parts.push(chalk.red(`${s.scenariosRemoved} scenario(s) removed`));
  if (s.decisionsAdded > 0) parts.push(chalk.green(`${s.decisionsAdded} decision(s) added`));
  if (s.decisionsModified > 0) parts.push(chalk.yellow(`${s.decisionsModified} decision(s) modified`));

  console.log(`\n  ${parts.join(", ")}`);
}
