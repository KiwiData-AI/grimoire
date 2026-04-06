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

/** Helper: set up a project with only specific files existing on disk. */
function withFiles(files: string[]) {
  mockFileExists.mockImplementation(async (path: string) =>
    files.some((f) => path.endsWith(f))
  );
}

/** Helper: set up readFileOrNull to return content keyed by filename suffix. */
function withFileContents(entries: Record<string, string>) {
  mockReadFileOrNull.mockImplementation(async (path: string) => {
    for (const [suffix, content] of Object.entries(entries)) {
      if (path.endsWith(suffix)) return content;
    }
    return null;
  });
}

/** Helper: find detection by category. */
function find(detections: Awaited<ReturnType<typeof detectTools>>, category: string) {
  return detections.find((d) => d.category === category);
}

const NODE_PKG = { "package.json": '{"name":"test"}' };
const PYPROJECT = { "pyproject.toml": "[project]\nname='x'\n" };

describe("detectTools", () => {
  it("returns no high-confidence detections for a bare directory", async () => {
    const detections = await detectTools("/fake");
    const highConf = detections.filter((d) => d.confidence === "high");
    expect(highConf).toHaveLength(0);
  });

  // --- Language detection ---

  it.each([
    { files: ["tsconfig.json"], contents: NODE_PKG, expected: "typescript" },
    { files: [], contents: NODE_PKG, expected: "javascript" },
    { files: [], contents: { "pyproject.toml": "[project]\nname='x'\n" }, expected: "python" },
    { files: ["requirements.txt"], contents: { "requirements.txt": "flask\n" }, expected: "python" },
    { files: ["go.mod"], contents: {}, expected: "go" },
    { files: ["Cargo.toml"], contents: {}, expected: "rust" },
  ])("detects $expected language", async ({ files, contents, expected }) => {
    withFiles(files);
    withFileContents(contents);
    const lang = find(await detectTools("/fake"), "language");
    expect(lang?.name).toBe(expected);
  });

  // --- Package manager detection ---

  it.each([
    { files: ["pnpm-lock.yaml"], contents: NODE_PKG, expected: "pnpm" },
    { files: ["yarn.lock"], contents: NODE_PKG, expected: "yarn" },
    { files: ["package-lock.json"], contents: NODE_PKG, expected: "npm" },
    { files: ["uv.lock"], contents: {}, expected: "uv" },
    { files: [], contents: { "pyproject.toml": "[tool.uv]\ndev-dependencies = []\n" }, expected: "uv" },
    { files: ["poetry.lock"], contents: PYPROJECT, expected: "poetry" },
    { files: [], contents: { "pyproject.toml": "[tool.poetry]\nname='x'\n" }, expected: "poetry" },
    { files: ["Pipfile"], contents: { "Pipfile": "[packages]\n" }, expected: "pipenv" },
    { files: ["requirements.txt"], contents: { "requirements.txt": "flask\n" }, expected: "pip" },
    { files: ["Cargo.toml"], contents: {}, expected: "cargo" },
    { files: ["go.mod"], contents: {}, expected: "go" },
  ])("detects $expected package manager", async ({ files, contents, expected }) => {
    withFiles(files);
    withFileContents(contents);
    const pm = find(await detectTools("/fake"), "package_manager");
    expect(pm?.name).toBe(expected);
  });

  // --- Linter detection ---

  it.each([
    { files: ["eslint.config.js"], contents: NODE_PKG, expected: "eslint" },
    { files: ["biome.json"], contents: {}, expected: "biome" },
    { files: [], contents: { "pyproject.toml": "[tool.ruff]\nline-length = 88\n" }, expected: "ruff" },
    { files: [".flake8"], contents: {}, expected: "flake8" },
    { files: [], contents: { "setup.cfg": "[flake8]\nmax-line-length = 120\n" }, expected: "flake8" },
  ])("detects $expected linter", async ({ files, contents, expected }) => {
    withFiles(files);
    withFileContents(contents);
    const lint = find(await detectTools("/fake"), "lint");
    expect(lint?.name).toBe(expected);
  });

  // --- Formatter detection ---

  it.each([
    { files: [".prettierrc"], contents: NODE_PKG, expected: "prettier" },
    { files: [], contents: { "package.json": '{"name":"test","prettier":{"semi":false}}' }, expected: "prettier" },
    { files: ["biome.json"], contents: {}, expected: "biome" },
    { files: [], contents: { "pyproject.toml": "[tool.black]\nline-length = 88\n" }, expected: "black" },
    { files: [], contents: { "pyproject.toml": "[tool.ruff.format]\nquote-style = 'double'\n" }, expected: "ruff" },
  ])("detects $expected formatter", async ({ files, contents, expected }) => {
    withFiles(files);
    withFileContents(contents);
    const fmt = find(await detectTools("/fake"), "format");
    expect(fmt?.name).toBe(expected);
  });

  // --- Unit test detection ---

  it.each([
    { files: ["vitest.config.ts"], contents: NODE_PKG, expected: "vitest" },
    { files: [], contents: { "package.json": JSON.stringify({ name: "t", devDependencies: { vitest: "^3" } }) }, expected: "vitest" },
    { files: ["jest.config.js"], contents: NODE_PKG, expected: "jest" },
    { files: [], contents: { "package.json": JSON.stringify({ name: "t", devDependencies: { jest: "^29" } }) }, expected: "jest" },
    { files: ["pytest.ini"], contents: {}, expected: "pytest" },
    { files: ["conftest.py"], contents: {}, expected: "pytest" },
    { files: [], contents: { "pyproject.toml": "[tool.pytest.ini_options]\nminversion = '6.0'\n" }, expected: "pytest" },
    { files: ["go.mod"], contents: {}, expected: "go test" },
  ])("detects $expected unit test framework", async ({ files, contents, expected }) => {
    withFiles(files);
    withFileContents(contents);
    const unit = find(await detectTools("/fake"), "unit_test");
    expect(unit?.name).toBe(expected);
  });

  // --- BDD detection ---

  it.each([
    { files: ["behave.ini"], contents: {}, expected: "behave" },
    { files: ["features", "steps"], contents: {}, expected: "behave" },
    { files: [], contents: { "requirements.txt": "pytest-bdd\n", ...PYPROJECT }, expected: "pytest-bdd" },
    { files: [], contents: { "package.json": JSON.stringify({ name: "t", devDependencies: { "@cucumber/cucumber": "^10" } }) }, expected: "cucumber-js" },
    { files: [], contents: { "package.json": JSON.stringify({ name: "t", devDependencies: { "playwright-bdd": "^7" } }) }, expected: "playwright-bdd" },
  ])("detects $expected BDD framework", async ({ files, contents, expected }) => {
    withFiles(files);
    withFileContents(contents);
    const bdd = find(await detectTools("/fake"), "bdd_test");
    expect(bdd?.name).toBe(expected);
  });

  // --- Complexity detection ---

  it.each([
    { contents: { "requirements.txt": "radon\n", ...PYPROJECT }, expected: "radon" },
    { contents: { "package.json": JSON.stringify({ name: "t", devDependencies: { "eslint-plugin-complexity": "^1" } }) }, expected: "eslint-complexity" },
  ])("detects $expected complexity tool", async ({ contents, expected }) => {
    withFileContents(contents);
    const c = find(await detectTools("/fake"), "complexity");
    expect(c?.name).toBe(expected);
  });

  // --- Security detection ---

  it.each([
    { files: [], contents: { "requirements.txt": "bandit\n", ...PYPROJECT }, expected: "bandit" },
    { files: [".semgrep.yml"], contents: {}, expected: "semgrep" },
    { files: ["package-lock.json"], contents: NODE_PKG, expected: "npm audit" },
  ])("detects $expected security tool", async ({ files = [], contents, expected }) => {
    withFiles(files);
    withFileContents(contents);
    const sec = find(await detectTools("/fake"), "security");
    expect(sec?.name).toBe(expected);
  });

  // --- Dep audit detection ---

  it.each([
    { files: ["package-lock.json"], contents: NODE_PKG, expected: "npm audit" },
    { files: ["yarn.lock"], contents: NODE_PKG, expected: "yarn audit" },
    { files: ["pnpm-lock.yaml"], contents: NODE_PKG, expected: "pnpm audit" },
    { files: [], contents: { "requirements.txt": "pip-audit\n", ...PYPROJECT }, expected: "pip-audit" },
    { files: [], contents: { "requirements.txt": "safety\n", ...PYPROJECT }, expected: "safety" },
  ])("detects $expected dep audit tool", async ({ files = [], contents, expected }) => {
    withFiles(files);
    withFileContents(contents);
    const dep = find(await detectTools("/fake"), "dep_audit");
    expect(dep?.name).toBe(expected);
  });

  it("recommends pip-audit for python projects without explicit audit tool", async () => {
    withFileContents(PYPROJECT);
    const dep = find(await detectTools("/fake"), "dep_audit");
    expect(dep?.name).toBe("pip-audit");
    expect(dep?.confidence).toBe("low");
  });

  // --- Secrets detection ---

  it.each([
    { file: ".secrets.baseline", expected: "detect-secrets" },
    { file: ".gitleaks.toml", expected: "gitleaks" },
    { file: ".trufflehog.yml", expected: "trufflehog" },
  ])("detects $expected secret scanner", async ({ file, expected }) => {
    withFiles([file]);
    const sec = find(await detectTools("/fake"), "secrets");
    expect(sec?.name).toBe(expected);
  });

  // --- Doc tool detection ---

  it.each([
    { files: ["docs/conf.py"], contents: {}, expected: "sphinx" },
    { files: ["mkdocs.yml"], contents: {}, expected: "mkdocs" },
    { files: [], contents: { "package.json": JSON.stringify({ name: "t", devDependencies: { typedoc: "^0.25" } }) }, expected: "typedoc" },
    { files: ["jsdoc.json"], contents: {}, expected: "jsdoc" },
    { files: ["Cargo.toml"], contents: {}, expected: "rustdoc" },
    { files: ["go.mod"], contents: {}, expected: "godoc" },
  ])("detects $expected doc tool", async ({ files = [], contents, expected }) => {
    withFiles(files);
    withFileContents(contents);
    const doc = find(await detectTools("/fake"), "doc_tool");
    expect(doc?.name).toBe(expected);
  });

  // --- Dead code detection ---

  it.each([
    { contents: { "package.json": JSON.stringify({ name: "t", devDependencies: { knip: "^5" } }) }, expected: "knip", confidence: "high" },
    { contents: { "package.json": JSON.stringify({ name: "t", devDependencies: { "ts-prune": "^0.10" } }) }, expected: "ts-prune", confidence: "high" },
    { contents: { "requirements.txt": "vulture\n", ...PYPROJECT }, expected: "vulture", confidence: "high" },
  ])("detects $expected dead code tool (high confidence)", async ({ contents, expected }) => {
    withFileContents(contents);
    const dc = find(await detectTools("/fake"), "dead_code");
    expect(dc?.name).toBe(expected);
    expect(dc?.confidence).toBe("high");
  });

  it.each([
    { files: ["knip.json"], contents: NODE_PKG, expected: "knip", signal: "knip.json" },
    { files: ["knip.ts"], contents: NODE_PKG, expected: "knip", signal: "knip.ts" },
  ])("detects knip from $signal config file", async ({ files, contents, expected, signal }) => {
    withFiles(files);
    withFileContents(contents);
    const dc = find(await detectTools("/fake"), "dead_code");
    expect(dc?.name).toBe(expected);
    expect(dc?.signal).toBe(signal);
  });

  it.each([
    { contents: NODE_PKG, expected: "knip" },
    { contents: PYPROJECT, expected: "vulture" },
  ])("recommends $expected dead code tool (low confidence) for projects without explicit tool", async ({ contents, expected }) => {
    withFileContents(contents);
    const dc = find(await detectTools("/fake"), "dead_code");
    expect(dc?.name).toBe(expected);
    expect(dc?.confidence).toBe("low");
  });

  it("detects deadcode for go projects (low confidence)", async () => {
    withFiles(["go.mod"]);
    const dc = find(await detectTools("/fake"), "dead_code");
    expect(dc?.name).toBe("deadcode");
    expect(dc?.confidence).toBe("low");
  });

  // --- Comment style detection ---

  it.each([
    { contents: { "pyproject.toml": '[tool.pydocstyle]\nconvention = "google"\n' }, expected: "google" },
    { contents: { "pyproject.toml": '[tool.pydocstyle]\nconvention = "numpy"\n' }, expected: "numpy" },
    { contents: { "pyproject.toml": '[tool.pydocstyle]\nconvention = "pep257"\n' }, expected: "pep257" },
    { contents: { "package.json": JSON.stringify({ name: "t", devDependencies: { typedoc: "^0.25" } }) }, expected: "tsdoc" },
    { contents: { "package.json": JSON.stringify({ name: "t", devDependencies: { jsdoc: "^4" } }) }, expected: "jsdoc" },
  ])("detects $expected comment style", async ({ contents, expected }) => {
    withFileContents(contents);
    const cs = find(await detectTools("/fake"), "comment_style");
    expect(cs?.name).toBe(expected);
  });

  it("detects sphinx comment style from docs directory", async () => {
    withFiles(["docs/conf.py"]);
    const cs = find(await detectTools("/fake"), "comment_style");
    expect(cs?.name).toBe("sphinx");
    expect(cs?.confidence).toBe("medium");
  });
});
