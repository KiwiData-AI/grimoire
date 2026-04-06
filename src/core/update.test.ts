import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateProject } from "./update.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../utils/fs.js", () => ({
  fileExists: vi.fn(),
  escapeRegex: vi.fn((s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
}));

import { readFile, writeFile, copyFile } from "node:fs/promises";
import { fileExists } from "../utils/fs.js";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockCopyFile = vi.mocked(copyFile);
const mockFileExists = vi.mocked(fileExists);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("updateProject", () => {
  it("throws when .grimoire directory doesn't exist", async () => {
    mockFileExists.mockResolvedValue(false);
    await expect(updateProject(".", { skipAgents: false, skipSkills: false })).rejects.toThrow(
      "No .grimoire/ directory found"
    );
  });

  it("creates AGENTS.md when it doesn't exist", async () => {
    mockFileExists.mockImplementation(async (path: string) => {
      if (path.includes(".grimoire") && !path.includes("AGENTS")) return true;
      return false;
    });
    mockReadFile.mockResolvedValue("# Grimoire Agent Instructions" as any);

    await updateProject(".", { skipAgents: false, skipSkills: true });

    const agentsWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("AGENTS.md")
    );
    expect(agentsWrite).toBeDefined();
    expect(String(agentsWrite![1])).toContain("GRIMOIRE:START");
  });

  it("updates AGENTS.md grimoire section when markers exist", async () => {
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("AGENTS.md") && !p.includes("node_modules") && !p.includes("dist")) {
        // Could be project AGENTS.md or package AGENTS.md
        if (p.includes(".grimoire") || p.includes("dist")) {
          return "# New Agent Instructions" as any;
        }
        return "# Project\n<!-- GRIMOIRE:START -->\nold content\n<!-- GRIMOIRE:END -->\n# Other" as any;
      }
      return "# New Agent Instructions" as any;
    });

    await updateProject(".", { skipAgents: false, skipSkills: true });

    const agentsWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("AGENTS.md")
    );
    expect(agentsWrite).toBeDefined();
    // Should still contain the Other section
    expect(String(agentsWrite![1])).toContain("# Other");
  });

  it("skips agents update when skipAgents is true", async () => {
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue("content" as any);

    await updateProject(".", { skipAgents: true, skipSkills: true });

    const agentsWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("AGENTS.md")
    );
    expect(agentsWrite).toBeUndefined();
  });

  it("copies skill files when not skipped", async () => {
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockResolvedValue("# Agent content" as any);

    await updateProject(".", { skipAgents: true, skipSkills: false });

    // Should have called copyFile for each skill
    expect(mockCopyFile.mock.calls.length).toBeGreaterThan(0);
    const skillPaths = mockCopyFile.mock.calls.map((c) => String(c[1]));
    expect(skillPaths.some((p) => p.includes("grimoire-draft"))).toBe(true);
  });
});
