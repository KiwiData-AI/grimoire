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
    access: vi.fn(),
    chmod: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../utils/fs.js", () => ({
  fileExists: vi.fn(),
  escapeRegex: vi.fn((s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
}));

vi.mock("./hooks.js", () => ({
  setupHooks: vi.fn().mockResolvedValue(undefined),
}));

import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { fileExists } from "../utils/fs.js";
import { setupHooks } from "./hooks.js";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockCopyFile = vi.mocked(copyFile);
const mockMkdir = vi.mocked(mkdir);
const mockFileExists = vi.mocked(fileExists);
const mockSetupHooks = vi.mocked(setupHooks);

const ALL_SKIPPED = {
  skipAgents: true,
  skipSkills: true,
  skipHooks: true,
  skipTemplates: true,
  forceTemplates: false,
  skipConfig: true,
};

const NONE_SKIPPED = {
  skipAgents: false,
  skipSkills: false,
  skipHooks: false,
  skipTemplates: false,
  forceTemplates: false,
  skipConfig: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

// Helper: set up mockFileExists to say .grimoire exists but nothing else by default
function setupBasicFs() {
  mockFileExists.mockImplementation(async (path: string) => {
    if (path.endsWith(".grimoire")) return true;
    return false;
  });
  mockReadFile.mockImplementation(async (path: any) => {
    const p = String(path);
    if (p.endsWith("package.json")) return JSON.stringify({ version: "1.0.0" }) as any;
    if (p.endsWith("AGENTS.md")) return "# Grimoire Agent Instructions" as any;
    return "" as any;
  });
}

describe("updateProject", () => {
  it("throws when .grimoire directory doesn't exist", async () => {
    mockFileExists.mockResolvedValue(false);
    await expect(updateProject(".", NONE_SKIPPED)).rejects.toThrow(
      "No .grimoire/ directory found"
    );
  });

  // --- AGENTS.md ---

  it("creates AGENTS.md when it doesn't exist", async () => {
    setupBasicFs();
    await updateProject(".", { ...ALL_SKIPPED, skipAgents: false });

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
      if (p.endsWith("package.json")) return JSON.stringify({ version: "1.0.0" }) as any;
      if (p.endsWith("AGENTS.md") && !p.includes("node_modules") && !p.includes("dist")) {
        if (p.includes(".grimoire") || p.includes("dist")) {
          return "# New Agent Instructions" as any;
        }
        return "# Project\n<!-- GRIMOIRE:START -->\nold content\n<!-- GRIMOIRE:END -->\n# Other" as any;
      }
      return "# New Agent Instructions" as any;
    });

    await updateProject(".", { ...ALL_SKIPPED, skipAgents: false });

    const agentsWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("AGENTS.md")
    );
    expect(agentsWrite).toBeDefined();
    expect(String(agentsWrite![1])).toContain("# Other");
  });

  it("skips agents update when skipAgents is true", async () => {
    setupBasicFs();
    await updateProject(".", ALL_SKIPPED);

    const agentsWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("AGENTS.md")
    );
    expect(agentsWrite).toBeUndefined();
  });

  // --- Skills ---

  it("copies skill files when not skipped", async () => {
    setupBasicFs();
    await updateProject(".", { ...ALL_SKIPPED, skipSkills: false });

    expect(mockCopyFile.mock.calls.length).toBeGreaterThan(0);
    const skillPaths = mockCopyFile.mock.calls.map((c) => String(c[1]));
    expect(skillPaths.some((p) => p.includes("grimoire-draft"))).toBe(true);
  });

  // --- Hooks ---

  it("calls setupHooks when not skipped", async () => {
    setupBasicFs();
    await updateProject(".", { ...ALL_SKIPPED, skipHooks: false });

    expect(mockSetupHooks).toHaveBeenCalledTimes(1);
  });

  it("skips hooks when skipHooks is true", async () => {
    setupBasicFs();
    await updateProject(".", ALL_SKIPPED);

    expect(mockSetupHooks).not.toHaveBeenCalled();
  });

  // --- Directories ---

  it("ensures grimoire directories exist", async () => {
    setupBasicFs();
    await updateProject(".", ALL_SKIPPED);

    const mkdirPaths = mockMkdir.mock.calls.map((c) => String(c[0]));
    expect(mkdirPaths.some((p) => p.includes("decisions"))).toBe(true);
    expect(mkdirPaths.some((p) => p.includes("changes"))).toBe(true);
    expect(mkdirPaths.some((p) => p.includes("archive"))).toBe(true);
    expect(mkdirPaths.some((p) => p.includes("bugs"))).toBe(true);
  });

  // --- Templates ---

  it("creates missing templates when not skipped", async () => {
    setupBasicFs();
    // Templates don't exist (setupBasicFs returns false for everything except .grimoire)
    await updateProject(".", { ...ALL_SKIPPED, skipTemplates: false });

    expect(mockCopyFile.mock.calls.length).toBeGreaterThan(0);
    const destPaths = mockCopyFile.mock.calls.map((c) => String(c[1]));
    expect(destPaths.some((p) => p.includes("template.md"))).toBe(true);
  });

  it("skips existing templates without force flag", async () => {
    mockFileExists.mockResolvedValue(true); // everything exists
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("package.json")) return JSON.stringify({ version: "1.0.0" }) as any;
      if (p.endsWith("config.yaml")) return "version: 2\nproject:\n  commit_style: conventional" as any;
      return "# content" as any;
    });

    await updateProject(".", {
      ...ALL_SKIPPED,
      skipTemplates: false,
      skipConfig: false,
    });

    // copyFile should NOT be called for templates since they exist and force is false
    const templateCopies = mockCopyFile.mock.calls.filter((c) =>
      String(c[1]).includes(".grimoire")
    );
    expect(templateCopies).toHaveLength(0);
  });

  it("overwrites templates with force flag", async () => {
    mockFileExists.mockResolvedValue(true);
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("package.json")) return JSON.stringify({ version: "1.0.0" }) as any;
      if (p.endsWith("config.yaml")) return "version: 2\nproject:\n  commit_style: conventional" as any;
      return "# content" as any;
    });

    await updateProject(".", {
      ...ALL_SKIPPED,
      skipTemplates: false,
      forceTemplates: true,
    });

    const templateCopies = mockCopyFile.mock.calls.filter((c) =>
      String(c[1]).includes(".grimoire")
    );
    expect(templateCopies.length).toBeGreaterThan(0);
  });

  it("skips templates when skipTemplates is true", async () => {
    setupBasicFs();
    await updateProject(".", ALL_SKIPPED);

    // No template-related copyFile calls
    const templateCopies = mockCopyFile.mock.calls.filter((c) => {
      const dest = String(c[1]);
      return dest.includes("template.md") || dest.includes("context.yml") || dest.includes("mapignore");
    });
    expect(templateCopies).toHaveLength(0);
  });

  // --- Config migration ---

  it("migrates v1 config to v2", async () => {
    mockFileExists.mockImplementation(async (path: string) => {
      if (path.endsWith(".grimoire")) return true;
      if (path.endsWith("config.yaml")) return true;
      return false;
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("config.yaml")) {
        return "version: 1\nproject:\n  commit_style: conventional\nchecks:\n  - lint\n  - format\nllm:\n  command: claude\n" as any;
      }
      if (p.endsWith("package.json")) return JSON.stringify({ version: "1.0.0" }) as any;
      return "# content" as any;
    });

    await updateProject(".", { ...ALL_SKIPPED, skipConfig: false });

    const configWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("config.yaml")
    );
    expect(configWrite).toBeDefined();
    const written = String(configWrite![1]);
    expect(written).toContain("version: 2");
    // Should have migrated flat llm to nested
    expect(written).toContain("thinking:");
    expect(written).toContain("coding:");
    // Should have added missing checks
    expect(written).toContain("dep_audit");
    expect(written).toContain("secrets");
    expect(written).toContain("best_practices");
  });

  it("skips config migration when already current version", async () => {
    mockFileExists.mockImplementation(async (path: string) => {
      if (path.endsWith(".grimoire")) return true;
      if (path.endsWith("config.yaml")) return true;
      return false;
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("config.yaml")) {
        return "version: 2\nproject:\n  commit_style: conventional\n" as any;
      }
      if (p.endsWith("package.json")) return JSON.stringify({ version: "1.0.0" }) as any;
      return "# content" as any;
    });

    await updateProject(".", { ...ALL_SKIPPED, skipConfig: false });

    const configWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("config.yaml")
    );
    expect(configWrite).toBeUndefined();
  });

  it("skips config migration when skipConfig is true", async () => {
    setupBasicFs();
    await updateProject(".", ALL_SKIPPED);

    const configWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("config.yaml")
    );
    expect(configWrite).toBeUndefined();
  });

  // --- Agent files ---

  it("updates cursor file when detected", async () => {
    mockFileExists.mockImplementation(async (path: string) => {
      if (path.endsWith(".grimoire")) return true;
      if (path.includes(".cursor/rules/grimoire.mdc")) return true;
      return false;
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("package.json")) return JSON.stringify({ version: "1.0.0" }) as any;
      return "# Grimoire Agent Instructions" as any;
    });

    await updateProject(".", { ...ALL_SKIPPED, skipAgents: false });

    const cursorWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("grimoire.mdc")
    );
    expect(cursorWrite).toBeDefined();
  });

  it("updates copilot file when detected", async () => {
    mockFileExists.mockImplementation(async (path: string) => {
      if (path.endsWith(".grimoire")) return true;
      if (path.includes("copilot-instructions.md")) return true;
      return false;
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("package.json")) return JSON.stringify({ version: "1.0.0" }) as any;
      if (p.includes("copilot-instructions.md"))
        return "# Project\n<!-- GRIMOIRE:START -->\nold\n<!-- GRIMOIRE:END -->" as any;
      return "# Grimoire Agent Instructions" as any;
    });

    await updateProject(".", { ...ALL_SKIPPED, skipAgents: false });

    const copilotWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("copilot-instructions.md")
    );
    expect(copilotWrite).toBeDefined();
  });

  // --- Config edge cases ---

  it("skips config migration when YAML is invalid", async () => {
    mockFileExists.mockImplementation(async (path: string) => {
      if (path.endsWith(".grimoire")) return true;
      if (path.endsWith("config.yaml")) return true;
      return false;
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("config.yaml")) return "{{invalid yaml" as any;
      if (p.endsWith("package.json")) return JSON.stringify({ version: "1.0.0" }) as any;
      return "# content" as any;
    });

    await updateProject(".", { ...ALL_SKIPPED, skipConfig: false });

    const configWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("config.yaml")
    );
    expect(configWrite).toBeUndefined();
  });

  it("migrates config with missing project section", async () => {
    mockFileExists.mockImplementation(async (path: string) => {
      if (path.endsWith(".grimoire")) return true;
      if (path.endsWith("config.yaml")) return true;
      return false;
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("config.yaml")) {
        return "version: 1\nchecks:\n  - lint\n" as any;
      }
      if (p.endsWith("package.json")) return JSON.stringify({ version: "1.0.0" }) as any;
      return "# content" as any;
    });

    await updateProject(".", { ...ALL_SKIPPED, skipConfig: false });

    const configWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("config.yaml")
    );
    expect(configWrite).toBeDefined();
    const written = String(configWrite![1]);
    expect(written).toContain("version: 2");
    expect(written).toContain("caveman: lite");
  });

  it("skips config migration when config.yaml doesn't exist", async () => {
    mockFileExists.mockImplementation(async (path: string) => {
      if (path.endsWith(".grimoire")) return true;
      if (path.endsWith("config.yaml")) return false;
      return false;
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("package.json")) return JSON.stringify({ version: "1.0.0" }) as any;
      return "# content" as any;
    });

    await updateProject(".", { ...ALL_SKIPPED, skipConfig: false });

    const configWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes("config.yaml")
    );
    expect(configWrite).toBeUndefined();
  });

  // --- Version stamp ---

  it("writes version stamp file", async () => {
    setupBasicFs();
    await updateProject(".", ALL_SKIPPED);

    const versionWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes(".version")
    );
    expect(versionWrite).toBeDefined();
    expect(String(versionWrite![1])).toContain("1.0.0");
  });

  it("does not fail when package.json is unreadable", async () => {
    mockFileExists.mockImplementation(async (path: string) => {
      if (path.endsWith(".grimoire")) return true;
      return false;
    });
    mockReadFile.mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.endsWith("package.json")) throw new Error("ENOENT");
      return "# content" as any;
    });

    // Should not throw
    await updateProject(".", ALL_SKIPPED);

    const versionWrite = mockWriteFile.mock.calls.find((c) =>
      String(c[0]).includes(".version")
    );
    expect(versionWrite).toBeUndefined();
  });
});
