import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCheck } from "./check.js";

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
}));

vi.mock("../utils/config.js", () => ({
  loadConfig: vi.fn(),
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

import { loadConfig } from "../utils/config.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const mockLoadConfig = vi.mocked(loadConfig);
// Access the promisify.custom function to control async behavior
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

  it("pretty prints skip and error statuses", async () => {
    mockExecFileAsync().mockImplementation(async (...args: any[]) => {
      const cmd = args[0] as string;
      const cmdArgs = args[1] as string[];
      // Make a non-exec error (no stdout property) for format step
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

  it("runs LLM step when tool name is llm", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      tools: {
        ...baseConfig.tools,
        review: { name: "llm", prompt: "Review code" },
      },
      checks: ["review"],
    } as any);

    // Mock "which" to find the LLM command, then mock spawn for the actual call
    mockExecFileAsync().mockImplementation(async (cmd: any, args: any) => {
      if (cmd === "which") return { stdout: "/usr/bin/claude", stderr: "" };
      if (cmd === "git") return { stdout: "file1.ts\nfile2.ts", stderr: "" };
      return { stdout: "OK", stderr: "" };
    });

    // Mock spawn for spawnWithStdin
    const { spawn } = await import("node:child_process");
    const mockSpawn = vi.mocked(spawn);
    const mockProc = {
      stdout: { on: vi.fn((event: string, cb: Function) => { if (event === "data") cb(Buffer.from("PASS - looks good")); }) },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn(), end: vi.fn() },
      on: vi.fn((event: string, cb: Function) => { if (event === "close") cb(0); }),
    };
    mockSpawn.mockReturnValue(mockProc as any);

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: true, json: true });
    expect(result.passed).toBe(1);
  });

  it("skips LLM step when command not found", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      tools: {
        review: { name: "llm", prompt: "Review code" },
      },
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

  it("handles LLM step with no changed files", async () => {
    mockLoadConfig.mockResolvedValue({
      ...baseConfig,
      tools: {
        review: { name: "llm", prompt: "Review code" },
      },
      checks: ["review"],
    } as any);

    mockExecFileAsync().mockImplementation(async (cmd: any, args: any) => {
      if (cmd === "which") return { stdout: "/usr/bin/claude", stderr: "" };
      if (cmd === "git") return { stdout: "", stderr: "" };
      return { stdout: "OK", stderr: "" };
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runCheck({ continueOnFail: false, changed: true, json: true });
    expect(result.passed).toBe(1);
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => logs.push(args.join(" ")));
    // Re-run to capture output
    const result2 = await runCheck({ continueOnFail: false, changed: true, json: true });
    const output = JSON.parse(logs.join(""));
    const reviewResult = output.results.find((r: any) => r.step === "review");
    expect(reviewResult.output).toContain("No changed files");
  });
});
