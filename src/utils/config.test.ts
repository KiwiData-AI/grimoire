import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

vi.mock("./paths.js", () => ({
  findProjectRoot: vi.fn().mockResolvedValue("/fake/root"),
}));

import { readFile } from "node:fs/promises";
import { loadConfig } from "./config.js";

const mockReadFile = vi.mocked(readFile);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadConfig", () => {
  it("returns defaults when config file does not exist", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const config = await loadConfig("/fake/root");

    expect(config.version).toBe(2);
    expect(config.project.commit_style).toBe("conventional");
    expect(config.features_dir).toBe("features");
    expect(config.checks).toContain("lint");
    expect(config.llm.thinking.command).toBe("claude");
  });

  it("parses a valid config", async () => {
    const yaml = `
version: 1
project:
  language: python
  commit_style: angular
features_dir: specs
tools:
  lint:
    name: ruff
    command: ruff check .
checks:
  - lint
  - format
llm:
  thinking:
    command: claude
    model: opus
  coding:
    command: claude
    model: sonnet
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project.language).toBe("python");
    expect(config.project.commit_style).toBe("angular");
    expect(config.features_dir).toBe("specs");
    expect(config.tools.lint?.name).toBe("ruff");
    expect(config.tools.lint?.command).toBe("ruff check .");
    expect(config.checks).toEqual(["lint", "format"]);
    expect(config.llm.thinking.model).toBe("opus");
    expect(config.llm.coding.model).toBe("sonnet");
  });

  it("supports legacy flat llm format", async () => {
    const yaml = `
version: 1
llm:
  command: codex
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.llm.thinking.command).toBe("codex");
    expect(config.llm.coding.command).toBe("codex");
  });

  it("supports legacy flat project fields", async () => {
    const yaml = `
version: 1
language: typescript
commit_style: conventional
doc_tool: typedoc
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project.language).toBe("typescript");
    expect(config.project.doc_tool).toBe("typedoc");
  });

  it("warns and returns defaults on malformed YAML", async () => {
    mockReadFile.mockResolvedValue("  invalid:\nyaml: [broken\n  : bad");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config = await loadConfig("/fake/root");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("Warning: failed to parse");
    expect(config.version).toBe(2);
    expect(config.project.commit_style).toBe("conventional");

    warnSpy.mockRestore();
  });

  it("uses default checks when checks is not an array", async () => {
    const yaml = `
version: 1
checks: not-an-array
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.checks).toContain("lint");
    expect(config.checks).toContain("security");
  });

  it("parses project.surface enum value", async () => {
    const yaml = `
version: 2
project:
  surface: web
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project.surface).toBe("web");
  });

  it("drops project.surface when value is not in the enum", async () => {
    const yaml = `
version: 2
project:
  surface: spaceship
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project.surface).toBeUndefined();
  });

  it("parses project.brand_dir override", async () => {
    const yaml = `
version: 2
project:
  brand_dir: design/brand
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project.brand_dir).toBe("design/brand");
  });

  it("leaves project.brand_dir undefined when absent", async () => {
    const yaml = `
version: 2
project:
  language: typescript
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project.brand_dir).toBeUndefined();
  });

  it("parses project.design_tool.mcp with command and args", async () => {
    const yaml = `
version: 2
project:
  design_tool:
    name: figma
    mcp:
      name: figma-dev-mode
      command: npx
      args:
        - "-y"
        - figma-developer-mcp@latest
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project.design_tool?.name).toBe("figma");
    expect(config.project.design_tool?.mcp?.name).toBe("figma-dev-mode");
    expect(config.project.design_tool?.mcp?.command).toBe("npx");
    expect(config.project.design_tool?.mcp?.args).toEqual(["-y", "figma-developer-mcp@latest"]);
  });

  it("uses findProjectRoot when no root argument is given", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const config = await loadConfig();

    expect(config.version).toBe(2);
    expect(config.project.commit_style).toBe("conventional");
  });

  it("parses tools with check_command and prompt", async () => {
    const yaml = `
version: 2
tools:
  duplicates:
    name: jscpd
    command: npx jscpd
    check_command: npx jscpd --reporters console
  best_practices:
    name: llm
    prompt: Review for best practices
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.tools.duplicates?.check_command).toBe("npx jscpd --reporters console");
    expect(config.tools.best_practices?.name).toBe("llm");
    expect(config.tools.best_practices?.prompt).toBe("Review for best practices");
  });

  it("parses project.integrations booleans", async () => {
    const yaml = `
version: 2
project:
  integrations:
    codebase_memory_mcp: true
    caveman_plugin: false
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project.integrations?.codebase_memory_mcp).toBe(true);
    expect(config.project.integrations?.caveman_plugin).toBe(false);
  });

  it("drops non-boolean integration values", async () => {
    const yaml = `
version: 2
project:
  integrations:
    codebase_memory_mcp: "yes"
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project.integrations?.codebase_memory_mcp).toBeUndefined();
  });

  it("parses project.precommit_review depth and block_on", async () => {
    const yaml = `
version: 2
project:
  precommit_review:
    depth: full
    block_on: blocker
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project.precommit_review?.depth).toBe("full");
    expect(config.project.precommit_review?.block_on).toBe("blocker");
  });

  it("drops out-of-enum precommit_review values", async () => {
    const yaml = `
version: 2
project:
  precommit_review:
    depth: deep
    block_on: maybe
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project.precommit_review?.depth).toBeUndefined();
    expect(config.project.precommit_review?.block_on).toBeUndefined();
  });

  it("parses compliance and agents string arrays", async () => {
    const yaml = `
version: 2
project:
  compliance:
    - OWASP
    - PCI-DSS
  agents:
    - claude
    - opencode
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project.compliance).toEqual(["OWASP", "PCI-DSS"]);
    expect(config.project.agents).toEqual(["claude", "opencode"]);
  });

  it("falls back coding llm to thinking when coding is absent", async () => {
    const yaml = `
version: 2
llm:
  thinking:
    command: claude
    model: opus
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.llm.thinking.command).toBe("claude");
    expect(config.llm.coding.command).toBe("claude");
    expect(config.llm.coding.model).toBe("opus");
  });

  it("parses bug_trackers with mcp servers", async () => {
    const yaml = `
version: 2
bug_trackers:
  - name: linear
    mcp:
      name: linear-mcp
      url: https://mcp.linear.app
      transport: sse
  - name: jira
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.bug_trackers).toHaveLength(2);
    expect(config.bug_trackers?.[0]).toMatchObject({
      name: "linear",
      mcp: { name: "linear-mcp", url: "https://mcp.linear.app", transport: "sse" },
    });
    expect(config.bug_trackers?.[1]?.name).toBe("jira");
    expect(config.bug_trackers?.[1]?.mcp).toBeUndefined();
  });

  it("parses testing_tools with purpose and mcp", async () => {
    const yaml = `
version: 2
testing_tools:
  - name: playwright
    purpose: e2e
    mcp:
      name: playwright-mcp
      command: npx
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.testing_tools).toHaveLength(1);
    expect(config.testing_tools?.[0]).toMatchObject({
      name: "playwright",
      purpose: "e2e",
      mcp: { name: "playwright-mcp", command: "npx" },
    });
  });

  it("filters non-object entries out of bug_trackers and testing_tools", async () => {
    const yaml = `
version: 2
bug_trackers:
  - name: linear
  - "not-an-object"
testing_tools:
  - 42
  - name: vitest
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.bug_trackers).toHaveLength(1);
    expect(config.bug_trackers?.[0]?.name).toBe("linear");
    expect(config.testing_tools).toHaveLength(1);
    expect(config.testing_tools?.[0]?.name).toBe("vitest");
  });

  it("round-trips a config with surface, brand_dir, and design_tool.mcp", async () => {
    const yaml = `
version: 2
project:
  language: typescript
  commit_style: conventional
  surface: mixed
  brand_dir: .grimoire/brand
  design_tool:
    name: figma
    url: https://figma.com/file/abc
    mcp:
      name: figma-dev-mode
      command: npx
      args: ["-y", "figma-developer-mcp@latest"]
      transport: stdio
`;
    mockReadFile.mockResolvedValue(yaml);

    const config = await loadConfig("/fake/root");

    expect(config.project).toMatchObject({
      language: "typescript",
      commit_style: "conventional",
      surface: "mixed",
      brand_dir: ".grimoire/brand",
      design_tool: {
        name: "figma",
        url: "https://figma.com/file/abc",
        mcp: {
          name: "figma-dev-mode",
          command: "npx",
          args: ["-y", "figma-developer-mcp@latest"],
          transport: "stdio",
        },
      },
    });
  });
});
