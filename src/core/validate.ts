import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { findProjectRoot, resolveChangePath } from "../utils/paths.js";
import { findFiles } from "../utils/fs.js";

interface ValidateOptions {
  strict: boolean;
  json: boolean;
}

export interface ValidationResult {
  file: string;
  errors: string[];
  warnings: string[];
}

export interface ValidateResult {
  results: ValidationResult[];
  errorCount: number;
  warnCount: number;
}

export async function validateChange(
  changeId: string | undefined,
  options: ValidateOptions
): Promise<ValidateResult> {
  const root = await findProjectRoot();
  const results: ValidationResult[] = [];

  if (changeId) {
    const changePath = resolveChangePath(root, changeId);
    await validateSingleChange(changePath, changeId, results, options);
  } else {
    // Validate all active changes
    const changesDir = join(root, ".grimoire", "changes");
    try {
      const entries = await readdir(changesDir, { withFileTypes: true });
      const changes = entries.filter((e) => e.isDirectory());

      if (changes.length === 0) {
        console.log("No active changes to validate.");
        return { results, errorCount: 0, warnCount: 0 };
      }

      for (const change of changes) {
        const changePath = join(changesDir, change.name);
        await validateSingleChange(
          changePath,
          change.name,
          results,
          options
        );
      }
    } catch {
      console.log("No .grimoire/changes/ directory found. Run grimoire init first.");
      return { results, errorCount: 0, warnCount: 0 };
    }
  }

  const errorCount = results.reduce((sum, r) => sum + r.errors.length, 0);
  const warnCount = results.reduce((sum, r) => sum + r.warnings.length, 0);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return { results, errorCount, warnCount };
  }

  // Print results
  for (const result of results) {
    if (result.errors.length > 0) {
      console.log(`\n${chalk.red("FAIL")} ${result.file}`);
      for (const err of result.errors) {
        console.log(`  ${chalk.red("error:")} ${err}`);
      }
    }
    if (result.warnings.length > 0) {
      console.log(`\n${chalk.yellow("WARN")} ${result.file}`);
      for (const warn of result.warnings) {
        console.log(`  ${chalk.yellow("warn:")} ${warn}`);
      }
    }
  }

  if (errorCount === 0) {
    console.log(chalk.green("\nValidation passed."));
  }

  console.log(
    `\n${errorCount} error(s), ${warnCount} warning(s)`
  );

  return { results, errorCount, warnCount };
}

async function validateSingleChange(
  changePath: string,
  changeId: string,
  results: ValidationResult[],
  options: ValidateOptions
): Promise<void> {
  // Check manifest exists and has valid frontmatter
  const manifestPath = join(changePath, "manifest.md");
  try {
    const manifestContent = await readFile(manifestPath, "utf-8");
    const manifestResult = validateManifest(
      `${changeId}/manifest.md`,
      manifestContent,
      options.strict
    );
    if (manifestResult.errors.length > 0 || manifestResult.warnings.length > 0) {
      results.push(manifestResult);
    }
  } catch {
    results.push({
      file: `${changeId}/manifest.md`,
      errors: ["Manifest file missing"],
      warnings: [],
    });
  }

  // Validate feature files
  const featuresDir = join(changePath, "features");
  try {
    const featureFiles = await findFiles(featuresDir, ".feature");
    for (const file of featureFiles) {
      const content = await readFile(file, "utf-8");
      const result = validateFeatureFile(file, content, options.strict);
      if (result.errors.length > 0 || result.warnings.length > 0) {
        results.push(result);
      }
    }
  } catch {
    // No features dir is ok if there are decisions
  }

  // Validate decision files
  const decisionsDir = join(changePath, "decisions");
  try {
    const decisionFiles = await findFiles(decisionsDir, ".md");
    for (const file of decisionFiles) {
      const content = await readFile(file, "utf-8");
      const result = validateDecisionFile(file, content, options.strict);
      if (result.errors.length > 0 || result.warnings.length > 0) {
        results.push(result);
      }
    }
  } catch {
    // No decisions dir is ok if there are features
  }
}

function validateFeatureFile(
  filePath: string,
  content: string,
  strict: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content.match(/^Feature:/m)) {
    errors.push("Missing Feature: declaration");
  }

  if (!content.match(/^\s+Scenario(?: Outline)?:/m)) {
    errors.push("No scenarios found");
  }

  // Check each Scenario and Scenario Outline has at least When + Then
  const scenarios = content
    .split(/^\s+Scenario(?: Outline)?:/m)
    .slice(1);
  for (const scenario of scenarios) {
    const scenarioName =
      scenario.split("\n")[0]?.trim() || "unnamed";

    if (!scenario.match(/^\s+When /m)) {
      errors.push(`Scenario "${scenarioName}" missing When step`);
    }
    if (!scenario.match(/^\s+Then /m)) {
      errors.push(`Scenario "${scenarioName}" missing Then step`);
    }

    // Check Scenario Outline has Examples
    const isOutline = content
      .split(scenarioName)[0]
      ?.match(/Scenario Outline:\s*$/m);
    if (isOutline && !scenario.match(/^\s+Examples:/m)) {
      errors.push(
        `Scenario Outline "${scenarioName}" missing Examples table`
      );
    }
  }

  if (strict) {
    // Check for user story
    if (
      !content.match(/As an?\s/i) ||
      !content.match(/I want\s/i) ||
      !content.match(/So that\s/i)
    ) {
      warnings.push(
        "Missing user story (As a / I want / So that)"
      );
    }

    // Warn about implementation details
    const implKeywords =
      /\b(database|SQL|API|endpoint|HTTP|POST|GET|class|function|method|import|module)\b/i;
    if (implKeywords.test(content)) {
      warnings.push(
        "Possible implementation details in feature file (should describe WHAT not HOW)"
      );
    }
  }

  return { file: filePath, errors, warnings };
}

function validateDecisionFile(
  filePath: string,
  content: string,
  strict: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check YAML frontmatter
  if (!content.startsWith("---")) {
    errors.push("Missing YAML frontmatter");
  } else {
    const frontmatter = content.split("---")[1] || "";

    if (!frontmatter.match(/status:/)) {
      errors.push("Frontmatter missing 'status' field");
    }
    if (!frontmatter.match(/date:/)) {
      errors.push("Frontmatter missing 'date' field");
    }
  }

  // Check required sections
  if (!content.match(/^## Context and Problem Statement/m)) {
    errors.push("Missing 'Context and Problem Statement' section");
  }
  if (!content.match(/^## Considered Options/m)) {
    errors.push("Missing 'Considered Options' section");
  }
  if (!content.match(/^## Decision Outcome/m)) {
    errors.push("Missing 'Decision Outcome' section");
  }

  if (strict) {
    if (!content.match(/^## Decision Drivers/m)) {
      warnings.push("Missing 'Decision Drivers' section");
    }
    if (!content.match(/^### Consequences/m)) {
      warnings.push("Missing 'Consequences' section");
    }
    if (!content.match(/^### Confirmation/m)) {
      warnings.push("Missing 'Confirmation' section");
    }
  }

  return { file: filePath, errors, warnings };
}

const VALID_MANIFEST_STATUSES = [
  "draft",
  "approved",
  "implementing",
  "complete",
];

function validateManifest(
  filePath: string,
  content: string,
  strict: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content.startsWith("---")) {
    if (strict) {
      errors.push("Missing YAML frontmatter (status, branch)");
    } else {
      warnings.push("Missing YAML frontmatter (status, branch)");
    }
  } else {
    const frontmatter = content.split("---")[1] || "";

    const statusMatch = frontmatter.match(/status:\s*(\S+)/);
    if (!statusMatch) {
      errors.push("Frontmatter missing 'status' field");
    } else if (!VALID_MANIFEST_STATUSES.includes(statusMatch[1])) {
      errors.push(
        `Invalid status "${statusMatch[1]}" — must be one of: ${VALID_MANIFEST_STATUSES.join(", ")}`
      );
    }
  }

  // Check required sections
  if (!content.match(/^## Why/m)) {
    errors.push("Missing 'Why' section");
  }
  if (
    !content.match(/^## Feature Changes/m) &&
    !content.match(/^## Decisions/m)
  ) {
    errors.push(
      "Must have at least one of 'Feature Changes' or 'Decisions' section"
    );
  }

  return { file: filePath, errors, warnings };
}
