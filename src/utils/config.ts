import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { findProjectRoot } from "./paths.js";

export interface ToolConfig {
  name: string;
  command?: string;
  check_command?: string;
  prompt?: string;
}

export type CavemanLevel = "none" | "lite" | "full" | "ultra";

export interface ProjectConfig {
  language?: string;
  package_manager?: string;
  commit_style: string;
  doc_tool?: string;
  comment_style?: string;
  caveman?: CavemanLevel;
}

export interface LlmAgentConfig {
  command: string;
  model?: string;
}

export interface LlmConfig {
  thinking: LlmAgentConfig;
  coding: LlmAgentConfig;
}

export interface GrimoireConfig {
  version: number;
  project: ProjectConfig;
  features_dir: string;
  decisions_dir: string;
  tools: Record<string, ToolConfig>;
  checks: string[];
  llm: LlmConfig;
}

const DEFAULT_CHECKS = [
  "lint",
  "format",
  "test_quality",
  "doc_style",
  "duplicates",
  "complexity",
  "dead_code",
  "unit_test",
  "bdd_test",
  "security",
  "best_practices",
];

const DEFAULT_LLM: LlmConfig = {
  thinking: { command: "claude" },
  coding: { command: "claude" },
};

const DEFAULT_CONFIG: GrimoireConfig = {
  version: 1,
  project: {
    commit_style: "conventional",
  },
  features_dir: "features",
  decisions_dir: ".grimoire/decisions",
  tools: {},
  checks: DEFAULT_CHECKS,
  llm: DEFAULT_LLM,
};

function parseTools(raw: Record<string, unknown>): Record<string, ToolConfig> {
  const tools: Record<string, ToolConfig> = {};
  if (raw.tools && typeof raw.tools === "object") {
    for (const [key, val] of Object.entries(
      raw.tools as Record<string, unknown>
    )) {
      if (val && typeof val === "object") {
        const t = val as Record<string, unknown>;
        tools[key] = {
          name: String(t.name ?? key),
          command: t.command ? String(t.command) : undefined,
          check_command: t.check_command ? String(t.check_command) : undefined,
          prompt: t.prompt ? String(t.prompt) : undefined,
        };
      }
    }
  }
  return tools;
}

function parseProject(raw: Record<string, unknown>): ProjectConfig {
  const projectRaw =
    raw.project && typeof raw.project === "object"
      ? (raw.project as Record<string, unknown>)
      : {};

  return {
    language: str(projectRaw.language ?? raw.language),
    package_manager: str(projectRaw.package_manager),
    commit_style: String(
      projectRaw.commit_style ?? raw.commit_style ?? DEFAULT_CONFIG.project.commit_style
    ),
    doc_tool: str(projectRaw.doc_tool ?? raw.doc_tool),
    comment_style: str(projectRaw.comment_style ?? raw.comment_style),
    caveman: str(projectRaw.caveman) as ProjectConfig["caveman"],
  };
}

function parseLlm(raw: Record<string, unknown>): LlmConfig {
  const llmRaw =
    raw.llm && typeof raw.llm === "object"
      ? (raw.llm as Record<string, unknown>)
      : {};

  if (llmRaw.thinking && typeof llmRaw.thinking === "object") {
    // New nested format: llm.thinking + llm.coding
    const thinkRaw = llmRaw.thinking as Record<string, unknown>;
    const codeRaw = (llmRaw.coding && typeof llmRaw.coding === "object")
      ? (llmRaw.coding as Record<string, unknown>)
      : thinkRaw;
    return {
      thinking: {
        command: String(thinkRaw.command ?? DEFAULT_LLM.thinking.command),
        model: str(thinkRaw.model),
      },
      coding: {
        command: String(codeRaw.command ?? DEFAULT_LLM.coding.command),
        model: str(codeRaw.model),
      },
    };
  }

  // Legacy flat format: llm.command applies to both
  const cmd = String(llmRaw.command ?? DEFAULT_LLM.thinking.command);
  return {
    thinking: { command: cmd },
    coding: { command: cmd },
  };
}

export async function loadConfig(root?: string): Promise<GrimoireConfig> {
  const projectRoot = root ?? (await findProjectRoot());
  const configPath = join(projectRoot, ".grimoire", "config.yaml");

  let content: string;
  try {
    content = await readFile(configPath, "utf-8");
  } catch {
    // Config file doesn't exist — use defaults
    return structuredClone(DEFAULT_CONFIG);
  }

  let raw: Record<string, unknown>;
  try {
    raw = (parseYaml(content) as Record<string, unknown>) ?? {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `Warning: failed to parse ${configPath}: ${msg}\nFalling back to default config.`
    );
    return structuredClone(DEFAULT_CONFIG);
  }

  return {
    version: Number(raw.version ?? 1),
    project: parseProject(raw),
    features_dir: String(raw.features_dir ?? DEFAULT_CONFIG.features_dir),
    decisions_dir: String(raw.decisions_dir ?? DEFAULT_CONFIG.decisions_dir),
    tools: parseTools(raw),
    checks: Array.isArray(raw.checks) ? (raw.checks as string[]) : DEFAULT_CHECKS,
    llm: parseLlm(raw),
  };
}

function str(val: unknown): string | undefined {
  return val ? String(val) : undefined;
}
