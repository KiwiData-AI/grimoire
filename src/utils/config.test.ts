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

    expect(config.version).toBe(1);
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
    expect(config.version).toBe(1);
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
