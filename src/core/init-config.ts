import type { GrimoireConfig, ToolConfig, ProjectSurface } from "../utils/config.js";
import type { Detection } from "./detect.js";

export const PROMPT_SURFACES: readonly ProjectSurface[] = [
  "tui",
  "web",
  "mobile",
  "api",
  "mixed",
];

export interface EssentialPrefill {
  codebaseMemoryMcp?: boolean;
  cavemanPlugin?: boolean;
  detectedSurface?: ProjectSurface;
}

export function buildMinimalConfig(): GrimoireConfig {
  return {
    version: 1,
    project: {
      commit_style: "conventional",
      comment_lint: "block",
    },
    features_dir: "features",
    decisions_dir: ".grimoire/decisions",
    tools: {},
    checks: [
      "lint",
      "format",
      "duplicates",
      "complexity",
      "dead_code",
      "unit_test",
      "bdd_test",
      "security",
      "dep_audit",
      "secrets",
      "best_practices",
    ],
    llm: {
      thinking: { command: "claude" },
      coding: { command: "claude" },
    },
  };
}

function confidenceRank(c: "high" | "medium" | "low"): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

export function bestByCategory(detections: Detection[]): Map<string, Detection> {
  const byCategory = new Map<string, Detection>();
  for (const d of detections) {
    const existing = byCategory.get(d.category);
    if (!existing || confidenceRank(d.confidence) > confidenceRank(existing.confidence)) {
      byCategory.set(d.category, d);
    }
  }
  return byCategory;
}

export function applyProjectDetections(config: GrimoireConfig, byCategory: Map<string, Detection>): void {
  const projectFields: Array<[string, keyof typeof config.project]> = [
    ["language", "language"],
    ["package_manager", "package_manager"],
    ["doc_tool", "doc_tool"],
    ["comment_style", "comment_style"],
  ];
  for (const [cat, field] of projectFields) {
    const d = byCategory.get(cat);
    if (d) (config.project as unknown as Record<string, unknown>)[field] = d.name;
  }
  const projectCategories = new Set(["language", "package_manager", "doc_tool", "comment_style"]);
  for (const [category, detection] of byCategory) {
    if (projectCategories.has(category)) continue;
    const tool: ToolConfig = { name: detection.name };
    if (detection.command) tool.command = detection.command;
    if (detection.check_command) tool.check_command = detection.check_command;
    config.tools[category] = tool;
  }
}

export function applyLlmFallbacks(config: GrimoireConfig, byCategory: Map<string, Detection>): void {
  if (!byCategory.has("security")) {
    config.tools.security = { name: "llm", prompt: "Review these changed files for security vulnerabilities. Tag each finding with OWASP Top 10 category and CWE ID. Check for: SQL injection (CWE-89), XSS (CWE-79), broken auth (CWE-287), insecure crypto (CWE-327), SSRF (CWE-918), path traversal (CWE-22), insecure deserialization (CWE-502), missing access control (CWE-862), CSRF (CWE-352), hardcoded secrets (CWE-798)." };
  }
  if (!byCategory.has("dep_audit")) {
    config.tools.dep_audit = { name: "llm", prompt: "Review these changed files for newly added dependencies or imports. Flag potential typosquatting (CWE-1357), packages you cannot verify as real, and packages with known security advisories. Check for misspellings (e.g., 'reqeusts' instead of 'requests')." };
  }
  if (!byCategory.has("secrets")) {
    config.tools.secrets = { name: "llm", prompt: "Review these changed files for hardcoded secrets (CWE-798), API keys, passwords, tokens, private keys, or credentials (CWE-312). Flag any string that looks like a secret value rather than a placeholder or environment variable reference." };
  }
  if (!byCategory.has("dead_code")) {
    config.tools.dead_code = { name: "llm", prompt: "Review these changed files for dead code: unused functions, unreachable branches, unused imports, unused variables, and exports that are never imported elsewhere. Only flag code that is clearly dead, not code that might be used dynamically." };
  }
  config.tools.best_practices = { name: "llm", prompt: "Review these changed files for best practices violations" };
  if (!config.tools.duplicates) {
    config.tools.duplicates = { name: "jscpd", command: "npx jscpd --reporters console" };
  }
}

export function surfaceFromDetection(
  d: Detection | undefined
): ProjectSurface | undefined {
  if (!d) return undefined;
  return PROMPT_SURFACES.includes(d.name as ProjectSurface)
    ? (d.name as ProjectSurface)
    : undefined;
}

export function buildIntegrationFlags(
  initialFlags: { codebaseMemoryMcp: boolean | undefined; cavemanPlugin: boolean | undefined },
  config: GrimoireConfig,
): { codebaseMemoryMcp: boolean | undefined; cavemanPlugin: boolean | undefined } {
  return {
    codebaseMemoryMcp: initialFlags.codebaseMemoryMcp ?? config.project.integrations?.codebase_memory_mcp,
    cavemanPlugin: initialFlags.cavemanPlugin ?? config.project.integrations?.caveman_plugin,
  };
}

const SECRET_PATTERN =
  /(.*_TOKEN|.*_KEY|.*_SECRET|.*_PASSWORD)\s*[:=]\s*[^$\s].*/i;

export function scanForSecrets(serialized: string): void {
  for (const line of serialized.split("\n")) {
    const m = line.match(SECRET_PATTERN);
    if (!m) continue;
    const value = line.slice(line.search(/[:=]/) + 1).trim();
    if (value.startsWith("${")) continue;
    throw new Error(
      `Refusing to write a secret to .grimoire/config.yaml: ${line.trim()}\n` +
        `Use \${ENV_VAR} references instead, then export the value in your shell.`
    );
  }
}
