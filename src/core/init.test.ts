import { describe, it, expect, vi, beforeEach } from "vitest";
import { initProject } from "./init.js";

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
  fileExists: vi.fn().mockResolvedValue(false),
  escapeRegex: vi.fn((s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
}));

vi.mock("./detect.js", () => ({
  detectTools: vi.fn().mockResolvedValue([]),
}));

vi.mock("./hooks.js", () => ({
  setupHooks: vi.fn().mockResolvedValue(undefined),
}));

import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { fileExists } from "../utils/fs.js";
import { detectTools } from "./detect.js";
import { setupHooks } from "./hooks.js";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockCopyFile = vi.mocked(copyFile);
const mockMkdir = vi.mocked(mkdir);
const mockFileExists = vi.mocked(fileExists);
const mockDetectTools = vi.mocked(detectTools);
const mockSetupHooks = vi.mocked(setupHooks);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  mockFileExists.mockResolvedValue(false);
  // AGENTS.md template from package
  mockReadFile.mockResolvedValue("# Grimoire Agent Instructions" as any);
});

describe("initProject", () => {
  it("creates required directory structure", async () => {
    await initProject(".", {
      skipAgents: true,
      skipSkills: true,
      noDetect: true,
      agents: [],
    });

    const mkdirPaths = mockMkdir.mock.calls.map((c) => String(c[0]));
    expect(mkdirPaths.some((p) => p.includes("features"))).toBe(true);
    expect(mkdirPaths.some((p) => p.includes(".grimoire/decisions"))).toBe(true);
    expect(mkdirPaths.some((p) => p.includes(".grimoire/changes"))).toBe(true);
    expect(mkdirPaths.some((p) => p.includes(".grimoire/archive"))).toBe(true);
    expect(mkdirPaths.some((p) => p.includes(".grimoire/docs"))).toBe(true);
  });

  it("copies decision template", async () => {
    await initProject(".", {
      skipAgents: true,
      skipSkills: true,
      noDetect: true,
      agents: [],
    });

    const copyPaths = mockCopyFile.mock.calls.map((c) => String(c[1]));
    expect(copyPaths.some((p) => p.includes("template.md"))).toBe(true);
  });

  it("copies mapignore and mapkeys config files", async () => {
    await initProject(".", {
      skipAgents: true,
      skipSkills: true,
      noDetect: true,
      agents: [],
    });

    const copyDests = mockCopyFile.mock.calls.map((c) => String(c[1]));
    expect(copyDests.some((p) => p.includes("mapignore"))).toBe(true);
    expect(copyDests.some((p) => p.includes("mapkeys"))).toBe(true);
  });

  it("generates minimal config with noDetect", async () => {
    await initProject(".", {
      skipAgents: true,
      skipSkills: true,
      noDetect: true,
      agents: [],
    });

    const configWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("config.yaml")
    );
    expect(configWrite).toBeDefined();
    const content = String(configWrite![1]);
    expect(content).toContain("version: 1");
  });

  it("skips existing config.yaml", async () => {
    mockFileExists.mockImplementation(async (path: string) => {
      return path.includes("config.yaml");
    });

    await initProject(".", {
      skipAgents: true,
      skipSkills: true,
      noDetect: true,
      agents: [],
    });

    const configWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("config.yaml")
    );
    expect(configWrite).toBeUndefined();
  });

  it("creates AGENTS.md when not skipped", async () => {
    await initProject(".", {
      skipAgents: false,
      skipSkills: true,
      noDetect: true,
      agents: [],
    });

    const agentsWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("AGENTS.md")
    );
    expect(agentsWrite).toBeDefined();
    expect(String(agentsWrite![1])).toContain("GRIMOIRE:START");
  });

  it("installs skills when not skipped", async () => {
    await initProject(".", {
      skipAgents: true,
      skipSkills: false,
      noDetect: true,
      agents: [],
    });

    const skillCopies = mockCopyFile.mock.calls.filter((c) =>
      String(c[1]).includes("skills")
    );
    expect(skillCopies.length).toBeGreaterThan(0);
  });

  it("sets up hooks when agents not skipped", async () => {
    await initProject(".", {
      skipAgents: false,
      skipSkills: true,
      noDetect: true,
      agents: [],
    });

    expect(mockSetupHooks).toHaveBeenCalled();
  });

  it("skips hooks when agents are skipped", async () => {
    await initProject(".", {
      skipAgents: true,
      skipSkills: true,
      noDetect: true,
      agents: [],
    });

    expect(mockSetupHooks).not.toHaveBeenCalled();
  });

  it("generates cursor agent file when requested", async () => {
    await initProject(".", {
      skipAgents: true,
      skipSkills: true,
      noDetect: true,
      agents: ["cursor"],
    });

    const cursorWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("grimoire.mdc")
    );
    expect(cursorWrite).toBeDefined();
    expect(String(cursorWrite![1])).toContain("alwaysApply: true");
  });

  it("generates copilot agent file when requested", async () => {
    await initProject(".", {
      skipAgents: true,
      skipSkills: true,
      noDetect: true,
      agents: ["copilot"],
    });

    const copilotWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("copilot-instructions.md")
    );
    expect(copilotWrite).toBeDefined();
    expect(String(copilotWrite![1])).toContain("GRIMOIRE:START");
  });

  it("handles unknown agent type gracefully", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.join(" "));
    });

    await initProject(".", {
      skipAgents: true,
      skipSkills: true,
      noDetect: true,
      agents: ["unknown-agent"],
    });

    expect(logs.some((l) => l.includes("unknown"))).toBe(true);
  });

  it("appends to existing AGENTS.md without markers", async () => {
    mockFileExists.mockImplementation(async (path: string) => {
      return path.includes("AGENTS.md");
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("AGENTS.md") && !p.includes("dist") && !p.includes("node_modules")) {
        // First call for the package AGENTS.md will be from PACKAGE_ROOT
        // We detect project vs package by whether the path has the project root
        return "# Existing agent instructions\n" as any;
      }
      return "# Grimoire Agent Instructions" as any;
    });

    await initProject(".", {
      skipAgents: false,
      skipSkills: true,
      noDetect: true,
      agents: [],
    });

    const agentsWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("AGENTS.md")
    );
    expect(agentsWrite).toBeDefined();
    const content = String(agentsWrite![1]);
    expect(content).toContain("GRIMOIRE:START");
  });
});
