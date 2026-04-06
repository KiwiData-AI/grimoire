import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectTools } from "./detect.js";

vi.mock("../utils/fs.js", async () => {
  const actual = await vi.importActual<typeof import("../utils/fs.js")>("../utils/fs.js");
  return {
    ...actual,
    fileExists: vi.fn().mockResolvedValue(false),
    readFileOrNull: vi.fn().mockResolvedValue(null),
  };
});

import { fileExists, readFileOrNull } from "../utils/fs.js";

const mockFileExists = vi.mocked(fileExists);
const mockReadFileOrNull = vi.mocked(readFileOrNull);

beforeEach(() => {
  vi.clearAllMocks();
  mockFileExists.mockResolvedValue(false);
  mockReadFileOrNull.mockResolvedValue(null);
});

describe("detectTools", () => {
  it("detects typescript language from tsconfig.json", async () => {
    mockReadFileOrNull.mockImplementation(async (path: string) => {
      if (path.endsWith("package.json")) return '{"name":"test"}';
      return null;
    });
    mockFileExists.mockImplementation(async (path: string) => {
      return path.endsWith("tsconfig.json");
    });

    const detections = await detectTools("/fake");
    const lang = detections.find((d) => d.category === "language");
    expect(lang?.name).toBe("typescript");
  });

  it("detects knip from dependencies", async () => {
    mockReadFileOrNull.mockImplementation(async (path: string) => {
      if (path.endsWith("package.json")) {
        return JSON.stringify({ name: "test", devDependencies: { knip: "^5.0.0" } });
      }
      return null;
    });

    const detections = await detectTools("/fake");
    const deadCode = detections.find((d) => d.category === "dead_code");
    expect(deadCode?.name).toBe("knip");
    expect(deadCode?.confidence).toBe("high");
    expect(deadCode?.command).toBe("npx knip");
  });

  it("detects vulture from python deps", async () => {
    mockReadFileOrNull.mockImplementation(async (path: string) => {
      if (path.endsWith("requirements.txt")) return "vulture\nflake8\n";
      if (path.endsWith("pyproject.toml")) return "[project]\nname = 'test'\n";
      return null;
    });

    const detections = await detectTools("/fake");
    const deadCode = detections.find((d) => d.category === "dead_code");
    expect(deadCode?.name).toBe("vulture");
    expect(deadCode?.confidence).toBe("high");
  });

  it("detects knip.json config file", async () => {
    mockReadFileOrNull.mockImplementation(async (path: string) => {
      if (path.endsWith("package.json")) return '{"name":"test"}';
      return null;
    });
    mockFileExists.mockImplementation(async (path: string) => {
      return path.endsWith("knip.json");
    });

    const detections = await detectTools("/fake");
    const deadCode = detections.find((d) => d.category === "dead_code");
    expect(deadCode?.name).toBe("knip");
    expect(deadCode?.signal).toBe("knip.json");
  });

  it("recommends knip for JS projects without explicit dead code tool", async () => {
    mockReadFileOrNull.mockImplementation(async (path: string) => {
      if (path.endsWith("package.json")) return '{"name":"test"}';
      return null;
    });

    const detections = await detectTools("/fake");
    const deadCode = detections.find((d) => d.category === "dead_code");
    expect(deadCode?.name).toBe("knip");
    expect(deadCode?.confidence).toBe("low");
  });

  it("detects npm as package manager from lock file", async () => {
    mockReadFileOrNull.mockImplementation(async (path: string) => {
      if (path.endsWith("package.json")) return '{"name":"test"}';
      return null;
    });
    mockFileExists.mockImplementation(async (path: string) => {
      return path.endsWith("package-lock.json");
    });

    const detections = await detectTools("/fake");
    const pm = detections.find((d) => d.category === "package_manager");
    expect(pm?.name).toBe("npm");
  });

  it("detects ruff linter from pyproject.toml", async () => {
    mockReadFileOrNull.mockImplementation(async (path: string) => {
      if (path.endsWith("pyproject.toml")) return "[tool.ruff]\nline-length = 88\n";
      return null;
    });

    const detections = await detectTools("/fake");
    const lint = detections.find((d) => d.category === "lint");
    expect(lint?.name).toBe("ruff");
  });

  it("returns empty for a bare directory", async () => {
    const detections = await detectTools("/fake");

    // Should have no high-confidence detections
    const highConf = detections.filter((d) => d.confidence === "high");
    expect(highConf).toHaveLength(0);
  });
});
