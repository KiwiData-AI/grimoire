import chalk from "chalk";
import { detectTools, type Detection } from "./detect.js";
import type { GrimoireConfig, CavemanLevel, ProjectSurface } from "../utils/config.js";
import { detectAgentFiles } from "./shared-setup.js";
import { runSections } from "./configure.js";
import {
  buildMinimalConfig,
  bestByCategory,
  applyProjectDetections,
  applyLlmFallbacks,
  surfaceFromDetection,
  PROMPT_SURFACES,
  type EssentialPrefill,
} from "./init-config.js";

const CATEGORY_LABELS: Record<string, string> = {
  language: "Language",
  package_manager: "Pkg manager",
  lint: "Linter",
  format: "Formatter",
  unit_test: "Unit tests",
  bdd_test: "BDD tests",
  complexity: "Complexity",
  security: "Security",
  dep_audit: "Dep audit",
  secrets: "Secrets",
  dead_code: "Dead code",
  doc_tool: "Doc tool",
  comment_style: "Comment style",
};

const CATEGORY_ORDER = [
  "language",
  "package_manager",
  "lint",
  "format",
  "unit_test",
  "bdd_test",
  "complexity",
  "security",
  "dep_audit",
  "secrets",
  "dead_code",
  "doc_tool",
  "comment_style",
];

export async function buildDetectedConfig(
  root: string,
  prefill: EssentialPrefill = {}
): Promise<{ config: GrimoireConfig; detection: Detection | null }> {
  console.log(chalk.bold("\nDetecting project tools...\n"));

  const detections = await detectTools(root);
  const config = buildMinimalConfig();

  if (detections.length === 0) {
    console.log(chalk.dim("  No tools detected. Using minimal config.\n"));
    return { config: await askEssentialPreferences(config, root, prefill), detection: null };
  }

  const byCategory = bestByCategory(detections);

  console.log(chalk.bold("  Detected tools:\n"));
  for (const cat of CATEGORY_ORDER) {
    const label = (CATEGORY_LABELS[cat] ?? cat).padEnd(14);
    const d = byCategory.get(cat);
    if (d) console.log(`    ${label} ${chalk.cyan(d.name.padEnd(16))} ${chalk.dim(`(${d.signal})`)}`);
    else console.log(`    ${label} ${chalk.dim("(none detected)")}`);
  }

  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log();
  const answer = await rl.question("  Accept detected tools? (Y/n/edit) ");

  const prefillWithSurface: EssentialPrefill = { ...prefill, detectedSurface: surfaceFromDetection(byCategory.get("surface")) };

  if (answer.toLowerCase() === "n") {
    rl.close();
    console.log(chalk.dim("  Skipping tool detection.\n"));
    return { config: await askEssentialPreferences(config, root, prefillWithSurface), detection: null };
  }

  if (answer.toLowerCase() === "edit") await editDetections(rl, byCategory);
  rl.close();

  applyProjectDetections(config, byCategory);
  applyLlmFallbacks(config, byCategory);

  return { config: await askEssentialPreferences(config, root, prefillWithSurface), detection: byCategory.get("language") ?? null };
}

async function editDetections(
  rl: import("node:readline/promises").Interface,
  byCategory: Map<string, Detection>
): Promise<void> {
  console.log(
    chalk.dim(
      "\n  For each tool, press Enter to accept, 'n' to skip, or type a custom name.\n"
    )
  );

  for (const cat of CATEGORY_ORDER) {
    const label = CATEGORY_LABELS[cat] ?? cat;
    const d = byCategory.get(cat);
    const current = d ? d.name : "none";
    const answer = await rl.question(`    ${label} [${current}]: `);
    const trimmed = answer.trim();
    if (trimmed.toLowerCase() === "n") {
      byCategory.delete(cat);
    } else if (trimmed && trimmed !== current) {
      byCategory.set(cat, {
        category: cat,
        name: trimmed,
        confidence: "low",
        signal: "user input",
      });
    }
  }
}

async function askEssentialPreferences(
  config: GrimoireConfig,
  root: string,
  prefill: EssentialPrefill = {}
): Promise<GrimoireConfig> {
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // 1. AI agents
  console.log(chalk.bold("\n  AI agents:\n"));
  console.log(chalk.dim("    Which AI coding tools will use these skills?"));
  console.log(
    chalk.dim(
      "    Skills install per tool: claude→.claude/skills, opencode→.opencode/skills, codex→.agents/skills."
    )
  );
  console.log(
    chalk.dim("    cursor/copilot use AGENTS.md-derived files (no skills).\n")
  );

  const detectedAgents = await detectAgentFiles(root).catch(
    () => [] as string[]
  );
  const defaultAgents =
    detectedAgents.length > 0 ? detectedAgents.join(",") : "claude";
  const agentsAnswer = await rl.question(
    `    AI agents (comma-separated: claude/opencode/codex/cursor/copilot) [${defaultAgents}]: `
  );
  const rawAgents = agentsAnswer.trim() || defaultAgents;
  config.project.agents = rawAgents
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // 2. Recommended integrations
  console.log(chalk.bold("\n  Recommended integrations:\n"));
  console.log(
    chalk.dim(
      "    These are optional but recommended. Saying yes records the intent"
    )
  );
  console.log(
    chalk.dim("    in config and prints install commands at the end.\n")
  );

  const integrations: {
    codebase_memory_mcp?: boolean;
    caveman_plugin?: boolean;
  } = {};

  if (prefill.codebaseMemoryMcp === undefined) {
    const cbmAnswer = await rl.question(
      "    Install codebase-memory-mcp (call graphs, code intelligence)? (Y/n) "
    );
    integrations.codebase_memory_mcp =
      cbmAnswer.trim().toLowerCase() !== "n";
  } else {
    integrations.codebase_memory_mcp = prefill.codebaseMemoryMcp;
  }

  if (prefill.cavemanPlugin === undefined) {
    const cavemanPluginAnswer = await rl.question(
      "    Install caveman skill plugin (Claude Code marketplace)? (y/N) "
    );
    integrations.caveman_plugin =
      cavemanPluginAnswer.trim().toLowerCase() === "y";
  } else {
    integrations.caveman_plugin = prefill.cavemanPlugin;
  }

  config.project.integrations = integrations;

  // 3. Surface
  await askSurface(rl, config, prefill.detectedSurface);

  // 4. Caveman level
  const currentCaveman = config.project.caveman ?? "lite";
  const cavemanAnswer = await rl.question(
    `    Token optimization (caveman)? (none/lite/full/ultra) [${currentCaveman}]: `
  );
  config.project.caveman = (
    cavemanAnswer.trim() ? cavemanAnswer.trim().toLowerCase() : currentCaveman
  ) as CavemanLevel;

  // 5. Commit style
  const commitAnswer = await rl.question(
    `    Commit style? (conventional/angular/custom) [${config.project.commit_style}]: `
  );
  if (commitAnswer.trim()) {
    config.project.commit_style = commitAnswer.trim();
  }

  // 6. Design tool + brand capture
  await runSections(rl, config, root, ["design"]);

  rl.close();
  console.log();
  return config;
}

async function askSurface(
  rl: import("node:readline/promises").Interface,
  config: GrimoireConfig,
  detected: ProjectSurface | undefined
): Promise<void> {
  const prompt = detected
    ? `    Project surface: ${detected} — confirm or override (tui/web/mobile/api/mixed/Enter to accept): `
    : `    Project surface? (tui/web/mobile/api/mixed/skip) `;
  const answer = (await rl.question(prompt)).trim().toLowerCase();
  if (!answer) {
    if (detected) config.project.surface = detected;
    return;
  }
  if (answer === "skip") return;
  if (PROMPT_SURFACES.includes(answer as ProjectSurface)) {
    config.project.surface = answer as ProjectSurface;
  }
}
