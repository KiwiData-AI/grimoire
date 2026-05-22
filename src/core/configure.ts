import { writeFile, readFile, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as yamlStringify } from "yaml";
import chalk from "chalk";
import { fileExists } from "../utils/fs.js";
import type {
  GrimoireConfig,
  ToolConfig,
  BugTrackerConfig,
  TestingToolConfig,
} from "../utils/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");

export type SectionName =
  | "tools"
  | "compliance"
  | "design"
  | "llm"
  | "trackers"
  | "testing";

export const SECTION_LABELS: Record<SectionName, string> = {
  tools: "Tools (doc generator, comment style, dead code finder)",
  compliance: "Compliance (frameworks, dep audit, secret scanning)",
  design: "Design (design tool, brand guidelines)",
  llm: "AI agents (thinking/coding model)",
  trackers: "Bug trackers",
  testing: "Testing tools",
};

const ALL_SECTIONS: SectionName[] = [
  "tools",
  "compliance",
  "design",
  "llm",
  "trackers",
  "testing",
];

type Rl = import("node:readline/promises").Interface;

// ---------------------------------------------------------------------------
// Moved MCP configs
// ---------------------------------------------------------------------------

const BUG_TRACKER_MCP: Record<
  string,
  {
    display: string;
    command?: string;
    args?: string[];
    url?: string;
    transport?: "stdio" | "sse" | "http";
  }
> = {
  jira: {
    display: "Atlassian (Jira + Confluence)",
    url: "https://mcp.atlassian.com/v1/sse",
    transport: "sse",
  },
  linear: {
    display: "Linear",
    url: "https://mcp.linear.app/mcp",
    transport: "http",
  },
  github: {
    display: "GitHub Issues",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
  },
};

const TESTING_TOOL_MCP: Record<
  string,
  { display: string; command: string; args: string[] }
> = {
  playwright: {
    display: "Playwright",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
  },
};

const DESIGN_TOOL_MCP: Record<
  string,
  { display: string; mcpName: string; command: string; args: string[] }
> = {
  figma: {
    display: "Figma Dev Mode",
    mcpName: "figma-dev-mode",
    command: "npx",
    args: ["-y", "figma-developer-mcp@latest"],
  },
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

async function askHex(rl: Rl, label: string): Promise<string> {
  while (true) {
    const answer = (
      await rl.question(`    ${label} (hex, e.g., #0066ff): `)
    ).trim();
    if (HEX_PATTERN.test(answer)) return answer;
    console.log(
      chalk.yellow(`    Invalid hex color "${answer}". Use #RGB or #RRGGBB.`)
    );
  }
}

async function findExistingTokens(root: string): Promise<string | null> {
  for (const candidate of ["tokens.json", "design-tokens.json"]) {
    const path = join(root, candidate);
    if (await fileExists(path)) return path;
  }
  return null;
}

function buildBrandTokens(input: {
  primary: string;
  secondary: string;
  accent: string;
  fontFamily: string;
  fontSize: string;
  spacing: string;
  logo: string;
  favicon: string;
}): Record<string, unknown> {
  const tokens: Record<string, unknown> = {
    color: {
      primary: { $value: input.primary, $type: "color" },
      secondary: { $value: input.secondary, $type: "color" },
      accent: { $value: input.accent, $type: "color" },
    },
  };
  if (input.fontFamily) {
    tokens.font = {
      family: { base: { $value: input.fontFamily, $type: "fontFamily" } },
      ...(input.fontSize
        ? {
            size: {
              base: { $value: `${input.fontSize}px`, $type: "dimension" },
            },
          }
        : {}),
    };
  }
  if (input.spacing) {
    tokens.spacing = {
      base: { $value: `${input.spacing}px`, $type: "dimension" },
    };
  }
  if (input.logo || input.favicon) {
    tokens.asset = {
      ...(input.logo ? { logo: { $value: input.logo, $type: "asset" } } : {}),
      ...(input.favicon
        ? { favicon: { $value: input.favicon, $type: "asset" } }
        : {}),
    };
  }
  return tokens;
}

function renderVoiceFile(voiceDo: string, voiceDont: string): string {
  return [
    "# Brand Voice & Tone",
    "",
    "Captured at `grimoire init`. Edit freely.",
    "",
    "## Do",
    "",
    `- ${voiceDo}`,
    "",
    "## Don't",
    "",
    `- ${voiceDont}`,
    "",
  ].join("\n");
}

async function writeDesignToolStub(
  root: string,
  designTool: string
): Promise<void> {
  const stubSrc = join(PACKAGE_ROOT, "templates", "design-tool-setup-stub.md");
  const stubDest = join(root, ".grimoire", "docs", "design-tool-setup.md");
  const template = await readFile(stubSrc, "utf-8");
  const rendered = template.replace(/\{\{tool\}\}/g, designTool);
  await writeFile(stubDest, rendered);
  console.log(`  ${chalk.green("created")} .grimoire/docs/design-tool-setup.md`);
}

function stripNone(answer: string): string | undefined {
  const trimmed = answer.trim();
  return trimmed && trimmed !== "none" ? trimmed : undefined;
}

// ---------------------------------------------------------------------------
// Section functions (exported so init --full can call them directly)
// ---------------------------------------------------------------------------


function applyDeadCodeAnswer(config: GrimoireConfig, answer: string): void {
  const t = answer.trim();
  if (!t || t === "auto") return;
  if (t === "none") {
    delete config.tools.dead_code;
    config.checks = config.checks.filter((c) => c !== "dead_code");
    return;
  }
  const deadCodeCommands: Record<string, string> = {
    knip: "npx knip",
    "ts-prune": "npx ts-prune",
    vulture: "vulture .",
    deadcode: "deadcode ./...",
  };
  config.tools.dead_code = { name: t, command: deadCodeCommands[t] ?? t };
}

export async function configureToolsSection(
  rl: Rl,
  config: GrimoireConfig
): Promise<void> {
  console.log(chalk.bold("\n  Code style & quality tools:\n"));

  const docToolAnswer = await rl.question(
    `    Doc generator? (sphinx/mkdocs/typedoc/jsdoc/none) [${config.project.doc_tool ?? "none"}]: `
  );
  if (docToolAnswer.trim()) config.project.doc_tool = stripNone(docToolAnswer);

  const commentAnswer = await rl.question(
    `    Comment/docstring style? (google/numpy/sphinx/jsdoc/tsdoc/none) [${config.project.comment_style ?? "none"}]: `
  );
  if (commentAnswer.trim()) config.project.comment_style = stripNone(commentAnswer);

  const currentDeadCode = config.tools.dead_code?.name ?? "auto";
  const deadCodeAnswer = await rl.question(
    `    Dead code finder? (knip/ts-prune/vulture/deadcode/none/auto) [${currentDeadCode}]: `
  );
  applyDeadCodeAnswer(config, deadCodeAnswer);
}

function applyToolAnswer(
  config: GrimoireConfig,
  toolKey: string,
  answer: string,
  commands: Record<string, string>,
  field: "command" | "check_command",
): void {
  const t = answer.trim();
  if (!t || t === "auto") return;
  if (t === "none") {
    delete config.tools[toolKey];
    config.checks = config.checks.filter((c) => c !== toolKey);
    return;
  }
  config.tools[toolKey] = { name: t, [field]: commands[t] ?? t };
}

export async function configureComplianceSection(
  rl: Rl,
  config: GrimoireConfig
): Promise<void> {
  console.log(chalk.bold("\n  Security & compliance:\n"));
  console.log(chalk.dim("    Which compliance frameworks apply to this project?"));
  console.log(chalk.dim("    Options: owasp, pci-dss, hipaa, soc2, gdpr, iso27001, or Enter to skip.\n"));

  const complianceAnswer = await rl.question(
    `    Compliance frameworks (comma-separated) [${(config.project.compliance ?? []).join(",") || "none"}]: `
  );
  if (complianceAnswer.trim() && complianceAnswer.trim().toLowerCase() !== "none") {
    config.project.compliance = complianceAnswer.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  }

  const depAuditAnswer = await rl.question(
    `    Dep audit tool? (npm-audit/pip-audit/safety/yarn-audit/pnpm-audit/none/auto) [${config.tools.dep_audit?.name ?? "auto"}]: `
  );
  applyToolAnswer(config, "dep_audit", depAuditAnswer, {
    "npm-audit": "npm audit --audit-level=high",
    "pip-audit": "pip-audit",
    safety: "safety check",
    "yarn-audit": "yarn audit --level high",
    "pnpm-audit": "pnpm audit --audit-level=high",
  }, "check_command");

  const secretsAnswer = await rl.question(
    `    Secret scanner? (detect-secrets/gitleaks/trufflehog/none/auto) [${config.tools.secrets?.name ?? "auto"}]: `
  );
  applyToolAnswer(config, "secrets", secretsAnswer, {
    "detect-secrets": "detect-secrets scan --baseline .secrets.baseline",
    gitleaks: "gitleaks detect --no-git",
    trufflehog: "trufflehog filesystem . --no-update",
  }, "check_command");
}

export async function configureDesignSection(
  rl: Rl,
  config: GrimoireConfig,
  root: string
): Promise<void> {
  console.log(chalk.bold("\n  Front-end design:\n"));
  console.log(
    chalk.dim("    Where do UI/UX designs live? This helps grimoire reference")
  );
  console.log(
    chalk.dim("    designs during requirements elicitation.\n")
  );

  const currentDesignTool = config.project.design_tool?.name ?? "none";
  const designToolAnswer = await rl.question(
    `    Design tool? (figma/sketch/penpot/framer/storybook/zeplin/none) [${currentDesignTool}]: `
  );
  const designTool = designToolAnswer.trim().toLowerCase();
  if (designTool && designTool !== "none") {
    const mcp = DESIGN_TOOL_MCP[designTool];
    let mcpServer: import("../utils/config.js").McpServer | undefined;

    if (mcp) {
      const installAnswer = await rl.question(
        `    Install ${mcp.display} MCP server? (Y/n) `
      );
      if (installAnswer.trim().toLowerCase() !== "n") {
        mcpServer = {
          name: mcp.mcpName,
          command: mcp.command,
          args: mcp.args,
        };
        console.log(chalk.green(`    ✓ ${mcp.display} MCP configured`));
        console.log(
          chalk.dim(
            "    Reminder: set FIGMA_ACCESS_TOKEN in your shell. Never paste it here."
          )
        );
      }
    } else {
      await writeDesignToolStub(root, designTool);
      console.log(
        chalk.dim(
          `    ${designTool} lacks a first-class MCP — see .grimoire/docs/design-tool-setup.md`
        )
      );
    }

    const designPathAnswer = await rl.question(
      `    Local design assets path? (e.g., designs/, docs/wireframes/) [none]: `
    );
    const designUrlAnswer = await rl.question(
      `    Design project URL? (e.g., Figma project link) [none]: `
    );
    config.project.design_tool = {
      name: designTool,
      path: stripNone(designPathAnswer),
      url: stripNone(designUrlAnswer),
      mcp: mcpServer,
    };
  }

  // Brand capture
  console.log(chalk.bold("\n  Brand guidelines:\n"));

  const existing = await findExistingTokens(root);
  if (existing) {
    const useExisting = await rl.question(
      `    Use existing tokens file at ${existing}? (Y/n) `
    );
    if (useExisting.trim().toLowerCase() !== "n") {
      await copyFile(
        existing,
        join(root, ".grimoire", "brand", "tokens.json")
      );
      console.log(
        `  ${chalk.green("created")} .grimoire/brand/tokens.json (copied)`
      );
      return;
    }
  }

  const captureAnswer = await rl.question(
    `    Capture brand guidelines now? (y/N) `
  );
  if (captureAnswer.trim().toLowerCase() !== "y") {
    console.log(
      chalk.dim(
        "    Run `grimoire configure design` later to add brand tokens."
      )
    );
    return;
  }

  const primary = await askHex(rl, "Primary color");
  const secondary = await askHex(rl, "Secondary color");
  const accent = await askHex(rl, "Accent color");
  const fontFamily = (
    await rl.question("    Font family (e.g., Inter, sans-serif): ")
  ).trim();
  const fontSize = (
    await rl.question("    Base font size (px, e.g., 16): ")
  ).trim();
  const spacing = (
    await rl.question("    Base spacing unit (px, e.g., 8): ")
  ).trim();
  const logo = (
    await rl.question("    Logo path (optional, Enter to skip): ")
  ).trim();
  const favicon = (
    await rl.question("    Favicon path (optional, Enter to skip): ")
  ).trim();
  const voiceDo = (await rl.question("    Voice — one do-example: ")).trim();
  const voiceDont = (
    await rl.question("    Voice — one don't-example: ")
  ).trim();

  const tokens = buildBrandTokens({
    primary,
    secondary,
    accent,
    fontFamily,
    fontSize,
    spacing,
    logo,
    favicon,
  });
  await writeFile(
    join(root, ".grimoire", "brand", "tokens.json"),
    JSON.stringify(tokens, null, 2) + "\n"
  );
  console.log(`  ${chalk.green("created")} .grimoire/brand/tokens.json`);

  await writeFile(
    join(root, ".grimoire", "brand", "voice.md"),
    renderVoiceFile(voiceDo, voiceDont)
  );
  console.log(`  ${chalk.green("created")} .grimoire/brand/voice.md`);
}

function applyAgentAnswer(agent: { command: string; model?: string }, cmdAnswer: string, modelAnswer: string): void {
  if (cmdAnswer.trim()) agent.command = cmdAnswer.trim();
  const m = modelAnswer.trim();
  if (m && m !== "default") agent.model = m === "auto" ? undefined : m;
}

export async function configureLlmSection(
  rl: Rl,
  config: GrimoireConfig
): Promise<void> {
  console.log(chalk.bold("\n  AI agent preferences:\n"));

  const thinkAnswer = await rl.question(
    `    Thinking agent (planning, review)? (claude/codex/cursor/custom) [${config.llm.thinking.command}]: `
  );
  const thinkModelAnswer = await rl.question(
    `    Thinking model? (opus/sonnet/o3/auto) [${config.llm.thinking.model ?? "default"}]: `
  );
  applyAgentAnswer(config.llm.thinking, thinkAnswer, thinkModelAnswer);

  const codeAnswer = await rl.question(
    `    Coding agent (apply, implement)? (claude/codex/cursor/custom) [${config.llm.coding.command}]: `
  );
  const codeModelAnswer = await rl.question(
    `    Coding model? (sonnet/opus/gpt-4.1/auto) [${config.llm.coding.model ?? "default"}]: `
  );
  applyAgentAnswer(config.llm.coding, codeAnswer, codeModelAnswer);
}

export async function configureTrackersSection(
  rl: Rl,
  config: GrimoireConfig
): Promise<void> {
  console.log(chalk.bold("\n  Bug trackers:\n"));
  console.log(
    chalk.dim("    Where do bug reports live? Add one or more trackers.")
  );
  console.log(
    chalk.dim(
      "    Options: jira, linear, github, other, or press Enter to skip.\n"
    )
  );

  const trackers: BugTrackerConfig[] = config.bug_trackers ?? [];
  let adding = true;
  while (adding) {
    const answer = await rl.question(
      `    Bug tracker${trackers.length > 0 ? " (another, or Enter to finish)" : ""}? `
    );
    const trimmed = answer.trim().toLowerCase();
    if (!trimmed) {
      adding = false;
      continue;
    }

    const known = BUG_TRACKER_MCP[trimmed];
    const tracker: BugTrackerConfig = { name: trimmed };

    if (known) {
      const installAnswer = await rl.question(
        `    Install ${known.display} MCP server? (Y/n) `
      );
      if (installAnswer.trim().toLowerCase() !== "n") {
        tracker.mcp = {
          name: known.display.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          command: known.command,
          args: known.args,
          url: known.url,
          transport: known.transport,
        };
        console.log(chalk.green(`    ✓ ${known.display} MCP configured`));
      }
    }

    trackers.push(tracker);
  }

  config.bug_trackers = trackers;
}

export async function configureTestingSection(
  rl: Rl,
  config: GrimoireConfig
): Promise<void> {
  console.log(chalk.bold("\n  Testing tools:\n"));
  console.log(
    chalk.dim("    What testing tools do your testers use? Add one or more.")
  );
  console.log(
    chalk.dim(
      "    Options: playwright, cypress, selenium, postman, other, or Enter to skip.\n"
    )
  );

  const tools: TestingToolConfig[] = config.testing_tools ?? [];
  let adding = true;
  while (adding) {
    const answer = await rl.question(
      `    Testing tool${tools.length > 0 ? " (another, or Enter to finish)" : ""}? `
    );
    const trimmed = answer.trim().toLowerCase();
    if (!trimmed) {
      adding = false;
      continue;
    }

    const purposeAnswer = await rl.question(
      `    Purpose? (e2e/integration/performance/api/general) [general]: `
    );
    const purpose = purposeAnswer.trim().toLowerCase() || "general";
    const tool: TestingToolConfig = { name: trimmed, purpose };

    const known = TESTING_TOOL_MCP[trimmed];
    if (known) {
      const installAnswer = await rl.question(
        `    Install ${known.display} MCP server? (Y/n) `
      );
      if (installAnswer.trim().toLowerCase() !== "n") {
        tool.mcp = { name: trimmed, command: known.command, args: known.args };
        console.log(chalk.green(`    ✓ ${known.display} MCP configured`));
      }
    }

    tools.push(tool);
  }

  config.testing_tools = tools;
}

// ---------------------------------------------------------------------------
// Main configure command entry point
// ---------------------------------------------------------------------------

async function pickSections(rl: Rl): Promise<SectionName[]> {
  console.log(chalk.bold("\nWhat would you like to configure?\n"));
  ALL_SECTIONS.forEach((key, i) => {
    console.log(`  ${i + 1}. ${SECTION_LABELS[key]}  [${key}]`);
  });
  console.log("  all. Everything\n");

  const answer = await rl.question(
    '  Section(s) — number, name, or "all" (comma-separated): '
  );
  const trimmed = answer.trim().toLowerCase();

  if (trimmed === "all" || trimmed === "") {
    return [...ALL_SECTIONS];
  }

  return trimmed
    .split(",")
    .map((s) => {
      const t = s.trim();
      const num = parseInt(t);
      if (!isNaN(num) && num >= 1 && num <= ALL_SECTIONS.length)
        return ALL_SECTIONS[num - 1];
      if ((ALL_SECTIONS as string[]).includes(t)) return t as SectionName;
      return null;
    })
    .filter((s): s is SectionName => s !== null);
}

export async function runSections(
  rl: Rl,
  config: GrimoireConfig,
  root: string,
  sections: SectionName[]
): Promise<void> {
  for (const section of sections) {
    switch (section) {
      case "tools":
        await configureToolsSection(rl, config);
        break;
      case "compliance":
        await configureComplianceSection(rl, config);
        break;
      case "design":
        await configureDesignSection(rl, config, root);
        break;
      case "llm":
        await configureLlmSection(rl, config);
        break;
      case "trackers":
        await configureTrackersSection(rl, config);
        break;
      case "testing":
        await configureTestingSection(rl, config);
        break;
    }
  }
}

export async function configureProject(
  root: string,
  requestedSections?: SectionName[]
): Promise<void> {
  const configPath = join(root, ".grimoire", "config.yaml");
  if (!(await fileExists(configPath))) {
    console.error(
      chalk.red("No .grimoire/config.yaml found. Run `grimoire init` first.")
    );
    process.exit(1);
  }

  const { loadConfig } = await import("../utils/config.js");
  const config = await loadConfig(root);

  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const sections =
    requestedSections && requestedSections.length > 0
      ? requestedSections
      : await pickSections(rl);

  await runSections(rl, config, root, sections);
  rl.close();

  const serialized = yamlStringify(config);
  await writeFile(configPath, serialized);
  console.log(chalk.green("\nConfiguration saved to .grimoire/config.yaml"));
}
