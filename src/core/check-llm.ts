import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { simpleGit } from "simple-git";
import { spawnWithStdin } from "../utils/spawn.js";
import type { ToolConfig } from "../utils/config.js";
import type { StepResult } from "./check.js";

const execFileAsync = promisify(execFile);
const MAX_DIFF_CHARS = 40_000;

async function resolveChangedFiles(root: string): Promise<{ files: string[]; diff: string }> {
  try {
    const git = simpleGit(root);
    const nameOnly = await git.diff(["--name-only", "HEAD"]);
    const files = nameOnly.trim().split("\n").filter(Boolean);
    if (files.length > 0) {
      const diff = await git.diff(["HEAD", "--", ...files]);
      return { files, diff };
    }
    const stagedNames = await git.diff(["--name-only", "--cached"]);
    const stagedFiles = stagedNames.trim().split("\n").filter(Boolean);
    const diff = await git.diff(["--cached", "--", ...stagedFiles]);
    return { files: stagedFiles, diff };
  } catch {
    return { files: [], diff: "" };
  }
}

function buildLlmPrompt(prompt: string, files: string[], diff: string): string {
  // Strip newlines and backticks from each filename to prevent prompt injection.
  const safeFiles = files.map((f) => `\`${f.replace(/[\n\r`]/g, "")}\``).filter((f) => f.length > 2);
  const fileList = safeFiles.length > 0 ? `\n\nFiles changed:\n${safeFiles.join("\n")}` : "";
  const safeDiff = diff.replace(/`{3,}/g, "```");
  const diffSection = safeDiff
    ? `\n\nDiff:\n\`\`\`diff\n${safeDiff.slice(0, MAX_DIFF_CHARS)}\n\`\`\``
    : "";
  return `${prompt}${fileList}${diffSection}\n\nOnly flag issues directly observable in the diff above. Do not infer issues from filenames or speculate about code not shown.\n\nRespond with PASS or FAIL as the very first word on the very first line (no markdown, no asterisks, no extra words on that line). Then explain any issues on subsequent lines.`;
}

function parseLlmVerdict(output: string): boolean {
  const firstLine = output.trim().split("\n").map((l) => l.trim()).find(Boolean)?.toUpperCase() ?? "";
  return /\bPASS\b/.test(firstLine) && !/\bFAIL\b/.test(firstLine);
}

export async function runLlmStep(
  step: string,
  prompt: string,
  llmCommand: string,
  root: string,
  changedOnly: boolean
): Promise<StepResult> {
  const start = Date.now();

  try {
    await execFileAsync("which", [llmCommand]);
  } catch {
    return { step, status: "skip", duration: Date.now() - start, output: "", reason: `${llmCommand} not found` };
  }

  const { files, diff } = changedOnly ? await resolveChangedFiles(root) : { files: [], diff: "" };

  if (changedOnly && files.length === 0) {
    return { step, status: "pass", duration: Date.now() - start, output: "No changed files to review." };
  }

  try {
    const output = await spawnWithStdin(llmCommand, ["--print"], buildLlmPrompt(prompt, files, diff), root);
    return { step, status: parseLlmVerdict(output) ? "pass" : "fail", duration: Date.now() - start, output };
  } catch (err) {
    return {
      step,
      status: "error",
      duration: Date.now() - start,
      output: err instanceof Error ? err.message : String(err),
      reason: "LLM command failed",
    };
  }
}

const BUILTIN_LLM_FALLBACKS: Record<string, ToolConfig> = {
  security: {
    name: "llm",
    prompt: `Review these changed files for security vulnerabilities. For each finding:
1. Describe the vulnerability
2. Tag it with the relevant OWASP Top 10 category (e.g., A01:2021-Broken Access Control) and CWE ID (e.g., CWE-89)
3. Rate severity: critical / high / medium / low

Check specifically for:
- SQL injection (CWE-89) — string concatenation in queries instead of parameterized queries
- XSS (CWE-79) — unescaped user input in HTML/template output
- Broken authentication (CWE-287) — custom token generation, weak session management, missing auth checks
- Insecure cryptography (CWE-327) — MD5/SHA1 for passwords, custom crypto, weak random
- SSRF (CWE-918) — user-controlled URLs in server-side requests
- Path traversal (CWE-22) — user input in file paths without sanitization
- Insecure deserialization (CWE-502) — pickle.loads, yaml.load without SafeLoader, eval()
- Missing access control (CWE-862) — endpoints without authorization checks
- CSRF (CWE-352) — state-changing endpoints without CSRF tokens
- Hardcoded secrets (CWE-798) — API keys, passwords, tokens in source code`,
  },
  dep_audit: {
    name: "llm",
    prompt: `Review these changed files for newly added dependencies or imports. For each finding:
1. Verify the package name is real and correctly spelled — flag potential typosquatting (e.g., 'reqeusts' instead of 'requests', 'lodash-utils' instead of 'lodash')
2. Flag packages you cannot verify as real published packages
3. Flag packages with known security advisories if you are aware of them
4. Tag supply chain risks with CWE-1357 (Reliance on Insufficiently Trustworthy Component)`,
  },
  secrets: {
    name: "llm",
    prompt: `Review these changed files for hardcoded secrets, API keys, passwords, tokens, private keys, or credentials.
Tag findings with CWE-798 (Use of Hard-coded Credentials) or CWE-312 (Cleartext Storage of Sensitive Information).
Flag any string that looks like a secret value rather than a placeholder or environment variable reference.
Check for: API keys, database connection strings, JWT secrets, private keys, OAuth client secrets, webhook URLs with tokens.`,
  },
  best_practices: {
    name: "llm",
    prompt: "Review these changed files for best practices violations",
  },
};

export function getBuiltinLlmFallback(step: string): ToolConfig | undefined {
  return BUILTIN_LLM_FALLBACKS[step];
}
