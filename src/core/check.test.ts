import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCheck } from "./check.js";

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
}));

vi.mock("../utils/config.js", () => ({
  loadConfig: vi.fn(),
}));

vi.mock("fast-glob", () => ({
  default: vi.fn().mockResolvedValue([]),
}));

vi.mock("./test-quality.js", () => ({
  analyzeTestQuality: vi.fn().mockResolvedValue({
    files: 0, functions: 0, issues: [],
    summary: { critical: 0, warning: 0, suggestion: 0 },
  }),
  TEST_FILE_GLOBS: ["**/*.test.ts"],
  TEST_FILE_IGNORE: ["**/node_modules/**"],
}));

vi.mock("./doc-style.js", () => ({
  checkDocStyle: vi.fn().mockResolvedValue({
    filesChecked: 0, issues: [],
  }),
}));

vi.mock("node:child_process", async () => {
  const { promisify } = await import("node:util");
  const fn = vi.fn((...args: any[]) => {
    const cb = args[args.length - 1];
    if (typeof cb === "function") cb(null, "OK", "");
  });
  const asyncFn = vi.fn(async () => ({ stdout: "OK", stderr: "" }));
  (fn as any)[promisify.custom] = asyncFn;
  return { execFile: fn, spawn: vi.fn() };
});

const mockGitDiff = vi.fn().mockResolvedValue("");
vi.mock("simple-git", () => ({
  simpleGit: vi.fn(() => ({ diff: mockGitDiff })),
}));

vi.mock("../utils/spawn.js", () => ({
  spawnWithStdin: vi.fn().mockResolvedValue("PASS"),
}));

import { loadConfig } from "../utils/config.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fg from "fast-glob";
import { analyzeTestQuality } from "./test-quality.js";
import { checkDocStyle } from "./doc-style.js";

const mockFg = vi.mocked(fg);
const mockAnalyze = vi.mocked(analyzeTestQuality);
const mockCheckDocStyle = vi.mocked(checkDocStyle);

const mockLoadConfig = vi.mocked(loadConfig);
const mockExecFileAsync = () => (execFile as any)[promisify.custom] as ReturnType<typeof vi.fn>;

const baseConfig = {
  version: 1,
  project: { commit_style: "conventional" },
  features_dir: "features",
  decisions_dir: ".grimoire/decisions",
  tools: {
    lint: { name: "eslint", command: "eslint src/", check_command: "eslint src/ --max-warnings 0" },
    format: { name: "prettier", command: "prettier --check ." },
    unit_test: { name: "vitest", command: "npx vitest run" },
  },
  checks: ["lint", "format", "unit_test", "security"],
  llm: { thinking: { command: "claude" }, coding: { command: "claude" } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadConfig.mockResolvedValue({ ...baseConfig } as any);
  mockExecFileAsync().mockResolvedValue({ stdout: "OK", stderr: "" });
});

describe("runCheck", () => {
  it("passes all configured steps that succeed", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, json: true });
    expect(result.passed).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("skips unconfigured steps", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, json: true });
    expect(result.skipped).toBeGreaterThan(0);
  });

  it("reports failure when command exits non-zero", async () => {
    mockExecFileAsync().mockImplementation(async (...args: any[]) => {
      const cmdArgs = args[1] as string[];
      const cmdStr = cmdArgs?.join(" ") ?? "";
      if (cmdStr.includes("eslint")) {
        const err = new Error("failed") as any;
        err.stdout = "Lint errors found";
        err.stderr = "";
        throw err;
      }
      return { stdout: "OK", stderr: "" };
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: true, changed: false, json: true });
    expect(result.failed).toBe(1);
  });

  it("stops on first failure when continueOnFail is false", async () => {
    mockExecFileAsync().mockImplementation(async (...args: any[]) => {
      const cmdArgs = args[1] as string[];
      const cmdStr = cmdArgs?.join(" ") ?? "";
      if (cmdStr.includes("eslint")) {
        const err = new Error("failed") as any;
        err.stdout = "error";
        err.stderr = "";
        throw err;
      }
      return { stdout: "OK", stderr: "" };
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, json: true });
    expect(result.failed).toBe(1);
    expect(result.passed).toBe(0);
  });

  it("respects skip option", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, skip: ["lint"], json: true });
    expect(result.passed).toBe(2);
  });

  it("runs only specified steps", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ steps: ["lint"], continueOnFail: false, changed: false, json: true });
    expect(result.passed).toBe(1);
  });

  it("returns correct summary counts", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: true, changed: false, json: true });
    expect(result.passed + result.failed + result.skipped + result.errored).toBe(4);
  });

  it("pretty prints results in non-json mode", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });
    await runCheck({ continueOnFail: false, changed: false, json: false });
    const output = logs.join("\n");
    expect(output).toContain("grimoire check");
    expect(output).toContain("passed");
  });

  it("pretty prints failure with output lines", async () => {
    mockExecFileAsync().mockImplementation(async (...args: any[]) => {
      const cmdArgs = args[1] as string[];
      if (cmdArgs?.join(" ")?.includes("eslint")) {
        const err = new Error("failed") as any;
        err.stdout = "Line 1 error\nLine 2 error\nLine 3\nLine 4\nLine 5\nLine 6 truncated";
        err.stderr = "";
        throw err;
      }
      return { stdout: "OK", stderr: "" };
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });
    await runCheck({ continueOnFail: true, changed: false, json: false });
    const output = logs.join("\n");
    expect(output).toContain("failed");
    expect(output).toContain("truncated");
  });

  it("pretty prints error status for non-exec errors", async () => {
    mockExecFileAsync().mockImplementation(async (...args: any[]) => {
      const cmdArgs = args[1] as string[];
      if (cmdArgs?.join(" ")?.includes("prettier")) {
        throw new Error("command not found");
      }
      return { stdout: "OK", stderr: "" };
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });
    await runCheck({ continueOnFail: true, changed: false, json: false });
    const output = logs.join("\n");
    expect(output).toContain("error");
  });

  it("skips LLM step when command not found", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      tools: { review: { name: "llm", prompt: "Review code" } },
      checks: ["review"],
    } as any);

    mockExecFileAsync().mockImplementation(async (cmd: any) => {
      if (cmd === "which") throw new Error("not found");
      return { stdout: "OK", stderr: "" };
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, json: true });
    expect(result.skipped).toBe(1);
  });

  it("passes LLM step when no changed files to review", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      tools: { review: { name: "llm", prompt: "Review code" } },
      checks: ["review"],
    } as any);

    mockExecFileAsync().mockImplementation(async (cmd: any) => {
      if (cmd === "which") return { stdout: "/usr/bin/claude", stderr: "" };
      return { stdout: "OK", stderr: "" };
    });
    mockGitDiff.mockResolvedValue("");

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: true, json: true });
    expect(result.passed).toBe(1);
  });

  // --- Built-in test_quality step ---

  it("runs test_quality as built-in step and passes when clean", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      tools: {},
      checks: ["test_quality"],
    } as any);
    mockFg.mockResolvedValue(["/fake/test_app.py"] as any);
    mockAnalyze.mockResolvedValue({
      files: 1, functions: 3, issues: [],
      summary: { critical: 0, warning: 0, suggestion: 0 },
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, json: true });
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("fails test_quality step when critical issues found", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      tools: {},
      checks: ["test_quality"],
    } as any);
    mockFg.mockResolvedValue(["/fake/test_app.py"] as any);
    mockAnalyze.mockResolvedValue({
      files: 1, functions: 2, issues: [
        { file: "/fake/test_app.py", line: 5, severity: "critical", rule: "empty-body", message: "empty" },
      ],
      summary: { critical: 1, warning: 0, suggestion: 0 },
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, json: true });
    expect(result.failed).toBe(1);
  });

  it("passes test_quality when no test files found", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      tools: {},
      checks: ["test_quality"],
    } as any);
    mockFg.mockResolvedValue([] as any);

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, json: true });
    expect(result.passed).toBe(1);
    expect(result.skipped).toBe(0);
  });

  // --- Built-in doc_style step ---

  it("skips doc_style when no comment_style configured", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      tools: {},
      checks: ["doc_style"],
    } as any);

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, json: true });
    expect(result.skipped).toBe(1);
  });

  it("runs doc_style and passes when no issues", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      project: { ...baseConfig.project, comment_style: "google" },
      tools: {},
      checks: ["doc_style"],
    } as any);
    mockCheckDocStyle.mockResolvedValue({ filesChecked: 10, issues: [] });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, json: true });
    expect(result.passed).toBe(1);
  });

  it("fails doc_style when critical issues found", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      project: { ...baseConfig.project, comment_style: "google" },
      tools: {},
      checks: ["doc_style"],
    } as any);
    mockCheckDocStyle.mockResolvedValue({
      filesChecked: 5,
      issues: [{ file: "src/app.py", line: 10, severity: "critical" as const, message: "wrong style" }],
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, json: true });
    expect(result.failed).toBe(1);
  });

  // --- Built-in complexity step ---

  it("skips complexity when no tool found", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      project: { ...baseConfig.project, language: "go" },
      tools: {},
      checks: ["complexity"],
    } as any);

    // Make `which` fail for both radon and npx
    mockExecFileAsync().mockImplementation(async (cmd: any) => {
      if (cmd === "which") throw new Error("not found");
      return { stdout: "OK", stderr: "" };
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, json: true });
    expect(result.skipped).toBe(1);
  });

  it("uses configured complexity tool over built-in", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      tools: { complexity: { name: "radon", command: "radon cc . -a" } },
      checks: ["complexity"],
    } as any);

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: false, json: true });
    // Should use the configured tool (which our mock makes succeed)
    expect(result.passed).toBe(1);
  });
});
