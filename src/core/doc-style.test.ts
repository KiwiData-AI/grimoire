import { describe, it, expect, vi } from "vitest";
import { checkDocStyle } from "./doc-style.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

vi.mock("fast-glob", () => ({
  default: vi.fn().mockResolvedValue([]),
}));

import { readFile } from "node:fs/promises";
import fg from "fast-glob";

const mockReadFile = vi.mocked(readFile);
const mockFg = vi.mocked(fg);

describe("checkDocStyle", () => {
  it("flags python function missing docstring for google style", async () => {
    mockFg.mockResolvedValue(["/fake/src/app.py"] as any);
    mockReadFile.mockResolvedValue(`
def process_data(items):
    return [i * 2 for i in items]
`);

    const report = await checkDocStyle("/fake", "google", "python");
    expect(report.filesChecked).toBe(1);
    const missing = report.issues.find(i => i.message.includes("missing a docstring"));
    expect(missing).toBeDefined();
  });

  it("flags sphinx-style params in google-style project", async () => {
    mockFg.mockResolvedValue(["/fake/src/app.py"] as any);
    mockReadFile.mockResolvedValue(`
def process_data(items):
    """Process the data.

    :param items: The items to process.
    :returns: Processed items.
    """
    return [i * 2 for i in items]
`);

    const report = await checkDocStyle("/fake", "google", "python");
    const wrong = report.issues.find(i => i.message.includes(":param"));
    expect(wrong).toBeDefined();
  });

  it("passes clean google-style docstrings", async () => {
    mockFg.mockResolvedValue(["/fake/src/app.py"] as any);
    mockReadFile.mockResolvedValue(`
def process_data(items):
    """Process the data.

    Args:
        items: The items to process.

    Returns:
        Processed items.
    """
    return [i * 2 for i in items]
`);

    const report = await checkDocStyle("/fake", "google", "python");
    expect(report.issues).toHaveLength(0);
  });

  it("skips private functions", async () => {
    mockFg.mockResolvedValue(["/fake/src/app.py"] as any);
    mockReadFile.mockResolvedValue(`
def _internal_helper():
    return 42
`);

    const report = await checkDocStyle("/fake", "google", "python");
    expect(report.issues).toHaveLength(0);
  });

  it("skips test functions", async () => {
    mockFg.mockResolvedValue(["/fake/src/app.py"] as any);
    mockReadFile.mockResolvedValue(`
def test_something():
    assert True
`);

    const report = await checkDocStyle("/fake", "google", "python");
    expect(report.issues).toHaveLength(0);
  });

  it("flags JSDoc type syntax in tsdoc-style project", async () => {
    mockFg.mockResolvedValue(["/fake/src/app.ts"] as any);
    mockReadFile.mockResolvedValue(`
/**
 * Process the data.
 * @param {string[]} items - The items.
 */
export function processData(items: string[]): string[] {
  return items;
}
`);

    const report = await checkDocStyle("/fake", "tsdoc", "typescript");
    const wrong = report.issues.find(i => i.message.includes("JSDoc"));
    expect(wrong).toBeDefined();
  });

  it("flags JS function missing doc comment", async () => {
    mockFg.mockResolvedValue(["/fake/src/app.ts"] as any);
    mockReadFile.mockResolvedValue(`
export function processData(items: string[]): string[] {
  return items;
}
`);

    const report = await checkDocStyle("/fake", "tsdoc", "typescript");
    const missing = report.issues.find(i => i.message.includes("missing"));
    expect(missing).toBeDefined();
  });

  it("returns empty report when no files found", async () => {
    mockFg.mockResolvedValue([] as any);

    const report = await checkDocStyle("/fake", "google", "python");
    expect(report.filesChecked).toBe(0);
    expect(report.issues).toHaveLength(0);
  });

  it("flags a comment referencing an external artifact", async () => {
    mockFg.mockResolvedValue(["/fake/src/app.py"] as any);
    mockReadFile.mockResolvedValue(`
def build_chat(model_id):
    """Resolve a chat model by id."""
    # implements LOG-OBS-003 from logging.feature; see ADR-0001
    return _resolve(model_id)
`);

    const report = await checkDocStyle("/fake", "google", "python");
    const orphan = report.issues.find(i => i.message.includes("external artifact"));
    expect(orphan).toBeDefined();
  });

  it("flags a docstring that leads with a prose paragraph", async () => {
    mockFg.mockResolvedValue(["/fake/src/app.py"] as any);
    mockReadFile.mockResolvedValue(`
def build_chat(model_id):
    """Build and return a chat model for the given id.

    This is the primary entry point used by every agent and team.
    It performs validation and falls back to defaults when needed.
    Another line of explanation that goes on and on here.

    Args:
        model_id: the model id.
    """
    return _resolve(model_id)
`);

    const report = await checkDocStyle("/fake", "google", "python");
    const essay = report.issues.find(i => i.message.includes("prose paragraph"));
    expect(essay).toBeDefined();
  });

  it("passes a terse self-contained docstring", async () => {
    mockFg.mockResolvedValue(["/fake/src/app.py"] as any);
    mockReadFile.mockResolvedValue(`
def build_chat(model_id):
    """Resolve a chat model by id. Raises on an unknown provider.

    Args:
        model_id: provider-prefixed model id.
    """
    return _resolve(model_id)
`);

    const report = await checkDocStyle("/fake", "google", "python");
    expect(report.issues).toHaveLength(0);
  });
});
