import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import matter from "gray-matter";
import {
  GherkinClassicTokenMatcher,
  Parser,
  AstBuilder,
} from "@cucumber/gherkin";
import { IdGenerator } from "@cucumber/messages";
import type { GherkinDocument, Scenario as GherkinScenario } from "@cucumber/messages";
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

function parseGherkin(content: string): GherkinDocument | null {
  try {
    const parser = new Parser(
      new AstBuilder(IdGenerator.uuid()),
      new GherkinClassicTokenMatcher()
    );
    return parser.parse(content);
  } catch {
    return null;
  }
}

function getScenarios(doc: GherkinDocument): GherkinScenario[] {
  if (!doc.feature) return [];
  const scenarios: GherkinScenario[] = [];
  for (const child of doc.feature.children) {
    if (child.scenario) {
      scenarios.push(child.scenario);
    }
    if (child.rule) {
      for (const ruleChild of child.rule.children) {
        if (ruleChild.scenario) {
          scenarios.push(ruleChild.scenario);
        }
      }
    }
  }
  return scenarios;
}

export function validateFeatureFile(
  filePath: string,
  content: string,
  strict: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const doc = parseGherkin(content);

  if (!doc || !doc.feature) {
    errors.push("Invalid Gherkin syntax — could not parse feature file");
    return { file: filePath, errors, warnings };
  }

  const feature = doc.feature;

  if (!feature.name || feature.name.trim() === "") {
    errors.push("Missing Feature name");
  }

  const scenarios = getScenarios(doc);

  if (scenarios.length === 0) {
    errors.push("No scenarios found");
  }

  for (const scenario of scenarios) {
    const name = scenario.name || "unnamed";
    const keywords = scenario.steps.map((s) => s.keyword.trim());

    if (!keywords.includes("When")) {
      errors.push(`Scenario "${name}" missing When step`);
    }
    if (!keywords.includes("Then")) {
      errors.push(`Scenario "${name}" missing Then step`);
    }

    // Scenario Outline must have Examples
    if (
      scenario.keyword === "Scenario Outline" &&
      scenario.examples.length === 0
    ) {
      errors.push(`Scenario Outline "${name}" missing Examples table`);
    }
  }

  if (strict) {
    // Check for user story in feature description
    const description = feature.description || "";
    if (
      !description.match(/As an?\s/i) ||
      !description.match(/I want\s/i) ||
      !description.match(/So that\s/i)
    ) {
      warnings.push(
        "Missing user story (As a / I want / So that)"
      );
    }

    // Warn about implementation details in step text
    const implKeywords =
      /\b(database|SQL|API|endpoint|HTTP|POST|GET|class|function|method|import|module)\b/i;
    for (const scenario of scenarios) {
      for (const step of scenario.steps) {
        if (implKeywords.test(step.text)) {
          warnings.push(
            `Possible implementation details in step: "${step.keyword.trim()} ${step.text}" (should describe WHAT not HOW)`
          );
        }
      }
    }
  }

  return { file: filePath, errors, warnings };
}

export function validateDecisionFile(
  filePath: string,
  content: string,
  strict: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check YAML frontmatter
  const { data: fm } = matter(content);
  if (!content.startsWith("---")) {
    errors.push("Missing YAML frontmatter");
  } else {
    if (!fm.status) {
      errors.push("Frontmatter missing 'status' field");
    }
    if (!fm.date) {
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
    if (!content.match(/^### Cost of Ownership/m)) {
      warnings.push("Missing 'Cost of Ownership' section");
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

export function validateManifest(
  filePath: string,
  content: string,
  strict: boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { data: mfm } = matter(content);
  if (!content.startsWith("---")) {
    if (strict) {
      errors.push("Missing YAML frontmatter (status, branch)");
    } else {
      warnings.push("Missing YAML frontmatter (status, branch)");
    }
  } else {
    if (!mfm.status) {
      errors.push("Frontmatter missing 'status' field");
    } else if (!VALID_MANIFEST_STATUSES.includes(mfm.status)) {
      errors.push(
        `Invalid status "${mfm.status}" — must be one of: ${VALID_MANIFEST_STATUSES.join(", ")}`
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

  if (strict) {
    if (!content.match(/^## Assumptions/m)) {
      warnings.push("Missing 'Assumptions' section");
    }
    if (!content.match(/^## Pre-Mortem/m)) {
      warnings.push("Missing 'Pre-Mortem' section");
    }
  }

  return { file: filePath, errors, warnings };
}
