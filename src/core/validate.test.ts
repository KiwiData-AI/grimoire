import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateChange } from "./validate.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
    readdir: vi.fn(),
  };
});

vi.mock("../utils/paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
  resolveChangePath: vi.fn((_root: string, id: string) => `/fake/root/.grimoire/changes/${id}`),
}));

vi.mock("../utils/fs.js", async () => {
  const actual = await vi.importActual<typeof import("../utils/fs.js")>("../utils/fs.js");
  return {
    ...actual,
    findFiles: vi.fn().mockResolvedValue([]),
  };
});

import { readFile } from "node:fs/promises";
import { findFiles } from "../utils/fs.js";

const mockReadFile = vi.mocked(readFile);
const mockFindFiles = vi.mocked(findFiles);

beforeEach(() => {
  vi.clearAllMocks();
  mockFindFiles.mockResolvedValue([]);
});

describe("validateChange - json mode", () => {
  it("detects missing Feature declaration", async () => {
    const featureContent = `
  Scenario: Something
    When I do a thing
    Then it works
`;
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) {
        return "---\nstatus: draft\n---\n## Why\nBecause.\n## Feature Changes\n- foo";
      }
      return featureContent;
    });

    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".feature") return ["/fake/root/.grimoire/changes/test-change/features/test.feature"];
      return [];
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await validateChange("test-change", { strict: false, json: true });

    const output = logs.join("\n");
    expect(output).toContain("Missing Feature: declaration");
  });

  it("detects missing frontmatter on decision file", async () => {
    const decisionContent = `# Use PostgreSQL

## Context and Problem Statement
We need a database.

## Considered Options
1. PostgreSQL
2. MySQL

## Decision Outcome
PostgreSQL.
`;
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) {
        return "---\nstatus: draft\n---\n## Why\nBecause.\n## Decisions\n- foo";
      }
      return decisionContent;
    });

    mockFindFiles.mockImplementation(async (_dir: string, ext: string) => {
      if (ext === ".md") return ["/fake/root/.grimoire/changes/test/decisions/001.md"];
      return [];
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await validateChange("test", { strict: false, json: true });

    const output = logs.join("\n");
    expect(output).toContain("Missing YAML frontmatter");
  });

  it("detects invalid manifest status", async () => {
    const manifestContent = `---
status: yolo
---
## Why
Because.
## Feature Changes
- something
`;
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return manifestContent;
      throw new Error("not found");
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await validateChange("test", { strict: false, json: true });

    expect(logs.join("\n")).toContain('Invalid status \\"yolo\\"');
  });

  it("validates a correct manifest with no errors", async () => {
    const manifestContent = `---
status: draft
---
## Why
Because we need this.
## Feature Changes
- add foo
`;
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return manifestContent;
      throw new Error("not found");
    });

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    const result = await validateChange("test", { strict: false, json: true });

    expect(result.errorCount).toBe(0);
    const parsed = JSON.parse(logs.join(""));
    expect(parsed).toEqual([]);
  });

  it("returns error count for programmatic use", async () => {
    mockReadFile.mockImplementation(async (path: any) => {
      if (path.includes("manifest.md")) return "no frontmatter\n## Why\nYes.\n## Feature Changes\n- x";
      throw new Error("not found");
    });

    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await validateChange("test", { strict: true, json: true });

    // strict mode: missing frontmatter is an error
    expect(result.errorCount).toBeGreaterThan(0);
  });
});
