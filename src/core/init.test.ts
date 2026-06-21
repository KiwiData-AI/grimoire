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
    readdir: vi.fn().mockImplementation(async (path: any) => {
      const p = String(path);
      if (p.includes("/skills/grimoire-")) {
        return [
          { name: "SKILL.md", isFile: () => true, isDirectory: () => false },
        ];
      }
      return [];
    }),
    stat: vi.fn().mockRejectedValue(new Error("ENOENT")),
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

// Programmable readline mock — answers consumed in order from a queue.
const readlineAnswers: string[] = [];
const promptHistory: string[] = [];

vi.mock("node:readline/promises", () => ({
  createInterface: () => ({
    question: vi.fn(async (prompt: string) => {
      promptHistory.push(prompt);
      return readlineAnswers.shift() ?? "";
    }),
    close: vi.fn(),
  }),
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
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockFileExists.mockResolvedValue(false);
  // AGENTS.md template from package
  mockReadFile.mockResolvedValue("# Grimoire Agent Instructions" as any);
  readlineAnswers.length = 0;
  promptHistory.length = 0;
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
    expect(mkdirPaths.some((p) => p.includes(".grimoire/docs"))).toBe(true);
    expect(mkdirPaths.some((p) => p.includes(".grimoire/brand"))).toBe(true);
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

  it("does not install retired map structure-config templates", async () => {
    await initProject(".", {
      skipAgents: true,
      skipSkills: true,
      noDetect: true,
      agents: [],
    });

    // mapignore/mapkeys/dupignore belonged to the deleted `grimoire map`
    // command; structure now comes from codebase-memory-mcp on demand.
    const copyDests = mockCopyFile.mock.calls.map((c) => String(c[1]));
    expect(copyDests.some((p) => p.includes("mapignore"))).toBe(false);
    expect(copyDests.some((p) => p.includes("mapkeys"))).toBe(false);
    expect(copyDests.some((p) => p.includes("dupignore"))).toBe(false);
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

  /**
   * Answer queue for askPreferences only (greenfield: no detection prompt).
   * Order MUST match prompt order in init.ts askPreferences().
   */
  function answersForFullFlow(overrides: Partial<Record<string, string>> = {}): string[] {
    const slots: Record<string, string> = {
      agents: "claude",
      cbmInstall: "n",
      cavemanInstall: "n",
      surface: "skip",         // omit surface from config
      caveman: "",
      commit: "",
      designTool: "none",
      captureBrand: "n",
      ...overrides,
    };
    return [
      slots.agents,
      slots.cbmInstall,
      slots.cavemanInstall,
      slots.surface,
      slots.caveman,
      slots.commit,
      slots.designTool,
      slots.captureBrand,
    ];
  }

  describe("askPreferences — surface prompt (§5)", () => {
    it("writes surface 'web' to config when user picks web on greenfield", async () => {
      readlineAnswers.push(...answersForFullFlow({ surface: "web" }));
      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
      });
      const configWrite = mockWriteFile.mock.calls.find((c) =>
        String(c[0]).includes("config.yaml")
      );
      expect(configWrite).toBeDefined();
      expect(String(configWrite![1])).toContain("surface: web");
    });

    it("respects user override 'tui' when detection picked web", async () => {
      mockDetectTools.mockResolvedValueOnce([
        {
          category: "surface",
          name: "web",
          confidence: "high",
          signal: "react in package.json",
        },
      ]);
      // detection flow asks "Accept detected tools?" first; "" = accept
      readlineAnswers.push("", ...answersForFullFlow({ surface: "tui" }));
      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
      });
      const configWrite = mockWriteFile.mock.calls.find((c) =>
        String(c[0]).includes("config.yaml")
      );
      expect(String(configWrite![1])).toContain("surface: tui");
    });

    it("omits surface when user picks 'skip' on greenfield", async () => {
      readlineAnswers.push(...answersForFullFlow({ surface: "skip" }));
      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
      });
      const configWrite = mockWriteFile.mock.calls.find((c) =>
        String(c[0]).includes("config.yaml")
      );
      expect(String(configWrite![1])).not.toContain("surface:");
    });
  });

  describe("askPreferences — design-tool MCP (§4)", () => {
    it("populates design_tool.mcp when user picks figma + accepts MCP", async () => {
      // After designTool="figma", flow asks: install Figma MCP? then design path then URL
      const answers = answersForFullFlow({ designTool: "figma" });
      // Insert MCP-install answer right after designTool ("Y" = yes)
      const designToolIdx = answers.indexOf("figma");
      answers.splice(designToolIdx + 1, 0, "y", "", ""); // install=Y, path=blank, url=blank
      readlineAnswers.push(...answers);
      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
      });
      const configWrite = mockWriteFile.mock.calls.find((c) =>
        String(c[0]).includes("config.yaml")
      );
      const content = String(configWrite![1]);
      expect(content).toContain("design_tool:");
      expect(content).toContain("name: figma");
      expect(content).toContain("mcp:");
      expect(content).toContain("figma-developer-mcp");
    });

    it("generates stub doc when user picks sketch (no first-class MCP)", async () => {
      const answers = answersForFullFlow({ designTool: "sketch" });
      const designToolIdx = answers.indexOf("sketch");
      answers.splice(designToolIdx + 1, 0, "", ""); // path=blank, url=blank
      readlineAnswers.push(...answers);
      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
      });
      const stubWrite = mockWriteFile.mock.calls.find((c) =>
        String(c[0]).includes("design-tool-setup.md")
      );
      expect(stubWrite).toBeDefined();
    });

    it("leaves design_tool undefined when user picks none", async () => {
      readlineAnswers.push(...answersForFullFlow({ designTool: "none" }));
      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
      });
      const configWrite = mockWriteFile.mock.calls.find((c) =>
        String(c[0]).includes("config.yaml")
      );
      expect(String(configWrite![1])).not.toContain("design_tool:");
    });

    it("never writes a literal token value to config", async () => {
      const answers = answersForFullFlow({ designTool: "figma" });
      const designToolIdx = answers.indexOf("figma");
      answers.splice(designToolIdx + 1, 0, "y", "", "");
      readlineAnswers.push(...answers);
      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
      });
      const configWrite = mockWriteFile.mock.calls.find((c) =>
        String(c[0]).includes("config.yaml")
      );
      const content = String(configWrite![1]);
      // No bare token assignment patterns
      expect(content).not.toMatch(/FIGMA_ACCESS_TOKEN\s*[:=]\s*[A-Za-z0-9]/);
    });
  });

  describe("askPreferences — secret scan on serialized config (§4.2a)", () => {
    it("rejects when serialized config contains a literal *_TOKEN value", async () => {
      const { scanForSecrets } = await import("./init-config.js");
      expect(() =>
        scanForSecrets("project:\n  custom: FIGMA_ACCESS_TOKEN: ghp_real_value\n")
      ).toThrow(/secret/i);
    });

    it("passes when *_TOKEN values use ${VAR} env-var references", async () => {
      const { scanForSecrets } = await import("./init-config.js");
      expect(() =>
        scanForSecrets(
          "project:\n  env: FIGMA_ACCESS_TOKEN: ${FIGMA_ACCESS_TOKEN}\n"
        )
      ).not.toThrow();
    });

    it("flags generic FOO_KEY assignment too (future-proof for new MCPs)", async () => {
      const { scanForSecrets } = await import("./init-config.js");
      expect(() =>
        scanForSecrets("project:\n  custom:\n    NEW_API_SECRET: hunter2plaintextvalue\n")
      ).toThrow(/secret/i);
    });
  });

  describe("askPreferences — brand capture (§3)", () => {
    it("writes tokens.json + voice.md when user accepts brand capture", async () => {
      const answers = answersForFullFlow({
        designTool: "none",
        captureBrand: "y",
      });
      const captureIdx = answers.indexOf("y");
      // After "y", flow asks for: existing-token use? (skipped if none), primary,
      // secondary, accent, font family, base font size, base spacing, logo, favicon,
      // voice do, voice don't.
      answers.splice(
        captureIdx + 1,
        0,
        "#0066ff",            // primary
        "#222222",            // secondary
        "#ff9900",            // accent
        "Inter, sans-serif",  // font family
        "16",                 // base font size
        "8",                  // base spacing
        "",                   // logo (skip)
        "",                   // favicon (skip)
        "Speak plainly.",     // voice do
        "Don't hedge."        // voice don't
      );
      readlineAnswers.push(...answers);
      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
      });
      const tokensWrite = mockWriteFile.mock.calls.find((c) =>
        String(c[0]).includes(".grimoire/brand/tokens.json")
      );
      expect(tokensWrite).toBeDefined();
      const tokens = JSON.parse(String(tokensWrite![1]));
      expect(tokens.color.primary.$value).toBe("#0066ff");
      expect(tokens.color.primary.$type).toBe("color");
      expect(tokens.color.secondary.$value).toBe("#222222");
      expect(tokens.color.accent.$value).toBe("#ff9900");
      expect(tokens.font.family.base.$value).toBe("Inter, sans-serif");
      expect(tokens.spacing.base.$value).toBe("8px");

      const voiceWrite = mockWriteFile.mock.calls.find((c) =>
        String(c[0]).includes(".grimoire/brand/voice.md")
      );
      expect(voiceWrite).toBeDefined();
      expect(String(voiceWrite![1])).toContain("Speak plainly.");
      expect(String(voiceWrite![1])).toContain("Don't hedge.");
    });

    it("re-prompts on invalid hex color", async () => {
      const answers = answersForFullFlow({
        designTool: "none",
        captureBrand: "y",
      });
      const captureIdx = answers.indexOf("y");
      answers.splice(
        captureIdx + 1,
        0,
        "#ZZZ123",            // primary — invalid, expect re-prompt
        "#0066ff",            // primary — retry
        "#222222",            // secondary
        "#ff9900",            // accent
        "Inter, sans-serif",
        "16",
        "8",
        "",
        "",
        "Do this.",
        "Don't do that."
      );
      readlineAnswers.push(...answers);
      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
      });
      const tokensWrite = mockWriteFile.mock.calls.find((c) =>
        String(c[0]).includes(".grimoire/brand/tokens.json")
      );
      expect(tokensWrite).toBeDefined();
      const tokens = JSON.parse(String(tokensWrite![1]));
      expect(tokens.color.primary.$value).toBe("#0066ff");
      // Re-prompt occurred: "Primary color" prompt appears at least twice
      const primaryPrompts = promptHistory.filter((p) => /primary color/i.test(p));
      expect(primaryPrompts.length).toBeGreaterThanOrEqual(2);
    });

    it("does not create .grimoire/brand/ files when user declines", async () => {
      readlineAnswers.push(
        ...answersForFullFlow({ designTool: "none", captureBrand: "n" })
      );
      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
      });
      const brandWrites = mockWriteFile.mock.calls.filter((c) =>
        String(c[0]).includes(".grimoire/brand/")
      );
      expect(brandWrites).toHaveLength(0);
    });

    it("offers to use existing repo tokens.json when found", async () => {
      mockFileExists.mockImplementation(async (path: string) => {
        return path.endsWith("/tokens.json") && !path.includes(".grimoire/brand/");
      });
      const answers = answersForFullFlow({
        designTool: "none",
        captureBrand: "y",
      });
      const captureIdx = answers.indexOf("y");
      // Detection prompt comes first after captureBrand="y"; answer Y to use existing
      answers.splice(captureIdx + 1, 0, "y");
      readlineAnswers.push(...answers);
      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
      });
      expect(promptHistory.some((p) => /use existing/i.test(p))).toBe(true);
      const tokensCopy = mockCopyFile.mock.calls.find((c) =>
        String(c[1]).includes(".grimoire/brand/tokens.json")
      );
      expect(tokensCopy).toBeDefined();
    });
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

  describe("next-steps output based on detection", () => {
    function captureConsoleLogs(): string[] {
      const logs: string[] = [];
      vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
        logs.push(args.map(String).join(" "));
      });
      return logs;
    }

    it("prints discover (not map) as next step for existing projects", async () => {
      mockDetectTools.mockResolvedValueOnce([
        {
          category: "language",
          name: "typescript",
          confidence: "high",
          signal: "tsconfig.json",
        },
      ]);
      // accept detection, then answer essential preferences
      readlineAnswers.push("", "claude", "n", "n", "skip", "", "", "none", "n", "", "", "", "", "", "", "", "", "", "");
      const logs = captureConsoleLogs();

      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
        full: false,
      });

      const allLog = logs.join("\n");
      expect(allLog).toMatch(/discover/i);
      expect(allLog).not.toMatch(/grimoire map/);
      expect(allLog).toMatch(/codebase-memory-mcp/);
    });

    it("prints draft (not discover) as next step for greenfield projects", async () => {
      mockDetectTools.mockResolvedValueOnce([]);
      // no detection prompt for empty results; go straight to essential preferences
      readlineAnswers.push("claude", "n", "n", "skip", "", "", "none", "n", "", "", "", "", "", "", "", "", "", "");
      const logs = captureConsoleLogs();

      await initProject(".", {
        skipAgents: true,
        skipSkills: true,
        noDetect: false,
        agents: [],
        full: false,
      });

      const nextStepsStart = logs.findIndex((l) => l.includes("Next steps"));
      const nextStepsLogs = nextStepsStart >= 0 ? logs.slice(nextStepsStart) : logs;
      const nextStepsText = nextStepsLogs.join("\n");

      expect(nextStepsText).toMatch(/draft/i);
      expect(nextStepsText).not.toMatch(/discover/i);
      expect(nextStepsText).not.toMatch(/grimoire map/);
      expect(nextStepsText).not.toMatch(/codebase-memory-mcp/);
    });
  });
});
