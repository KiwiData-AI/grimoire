import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCi } from "./ci.js";

vi.mock("./validate.js", () => ({
  validateChange: vi.fn(),
}));

vi.mock("./check.js", () => ({
  runCheck: vi.fn(),
}));

vi.mock("./test-quality.js", () => ({
  analyzeTestQuality: vi.fn(),
}));

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
}));

vi.mock("../utils/fs.js", () => ({
  fileExists: vi.fn().mockResolvedValue(false),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("fast-glob", () => ({ default: vi.fn().mockResolvedValue([]) }));

import { validateChange } from "./validate.js";
import { runCheck } from "./check.js";
import { analyzeTestQuality } from "./test-quality.js";
import { fileExists } from "../utils/fs.js";

const mockValidate = vi.mocked(validateChange);
const mockRunCheck = vi.mocked(runCheck);
const mockAnalyze = vi.mocked(analyzeTestQuality);
const mockFileExists = vi.mocked(fileExists);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});

  mockValidate.mockResolvedValue({
    results: [],
    errorCount: 0,
    warnCount: 0,
  } as any);

  mockRunCheck.mockResolvedValue({
    results: [],
    passed: 1,
    failed: 0,
    skipped: 0,
    errored: 0,
  });

  mockAnalyze.mockResolvedValue({
    issues: [],
    summary: { critical: 0, warning: 0, info: 0 },
    fileCount: 0,
  } as any);
});

describe("runCi", () => {
  it("returns exitCode 0 when all checks pass", async () => {
    const result = await runCi({ annotations: false, setup: false });
    expect(result.exitCode).toBe(0);
    expect(result.validate.errors).toBe(0);
    expect(result.check.failed).toBe(0);
  });

  it("returns exitCode 1 when validate has errors", async () => {
    mockValidate.mockResolvedValue({
      results: [{ file: "test.feature", errors: ["bad"], warnings: [] }],
      errorCount: 1,
      warnCount: 0,
    } as any);

    const result = await runCi({ annotations: false, setup: false });
    expect(result.exitCode).toBe(1);
    expect(result.validate.errors).toBe(1);
  });

  it("returns exitCode 1 when check has failures", async () => {
    mockRunCheck.mockResolvedValue({
      results: [{ step: "lint", status: "fail", duration: 100, output: "error" }],
      passed: 0,
      failed: 1,
      skipped: 0,
      errored: 0,
    });

    const result = await runCi({ annotations: false, setup: false });
    expect(result.exitCode).toBe(1);
    expect(result.check.failed).toBe(1);
  });

  it("returns exitCode 1 when test quality has critical issues", async () => {
    const fg = (await import("fast-glob")).default as any;
    vi.mocked(fg).mockResolvedValue(["test.test.ts"]);

    mockAnalyze.mockResolvedValue({
      issues: [{ file: "test.ts", line: 1, message: "bad", severity: "critical" }],
      summary: { critical: 1, warning: 0, info: 0 },
      fileCount: 1,
    } as any);

    const result = await runCi({ annotations: false, setup: false });
    expect(result.exitCode).toBe(1);
    expect(result.testQuality.critical).toBe(1);
  });

  it("setup mode generates workflow file", async () => {
    mockFileExists.mockResolvedValue(false);
    const { writeFile } = await import("node:fs/promises");
    const mockWriteFile = vi.mocked(writeFile);

    const result = await runCi({ annotations: false, setup: true });
    expect(result.exitCode).toBe(0);
    expect(mockWriteFile).toHaveBeenCalled();
    const writePath = String(mockWriteFile.mock.calls[0][0]);
    expect(writePath).toContain("grimoire.yml");
  });

  it("passes skip option to runCheck", async () => {
    await runCi({ annotations: false, setup: false, skip: ["lint"] });
    expect(mockRunCheck).toHaveBeenCalledWith(
      expect.objectContaining({ skip: ["lint"] })
    );
  });
});
