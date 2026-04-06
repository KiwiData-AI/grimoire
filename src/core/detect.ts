import { join } from "node:path";
import { fileExists, readFileOrNull } from "../utils/fs.js";

export interface Detection {
  category: string;
  name: string;
  confidence: "high" | "medium" | "low";
  signal: string;
  command?: string;
  check_command?: string;
}

/**
 * Pre-read shared files once to avoid repeated disk I/O across detectors.
 */
interface ProjectFiles {
  pkg: Record<string, unknown> | null;
  pyproject: string | null;
  pythonDeps: string;
  root: string;
}

async function loadProjectFiles(root: string): Promise<ProjectFiles> {
  const pkgContent = await readFileOrNull(join(root, "package.json"));
  let pkg: Record<string, unknown> | null = null;
  if (pkgContent) {
    try {
      pkg = JSON.parse(pkgContent) as Record<string, unknown>;
    } catch {
      // malformed package.json
    }
  }

  const pyproject = await readFileOrNull(join(root, "pyproject.toml"));

  const pythonSources = [
    pyproject,
    await readFileOrNull(join(root, "requirements.txt")),
    await readFileOrNull(join(root, "requirements-dev.txt")),
    await readFileOrNull(join(root, "Pipfile")),
  ];
  const pythonDeps = pythonSources.filter(Boolean).join("\n");

  return { pkg, pyproject, pythonDeps, root };
}

function hasDep(
  pkg: Record<string, unknown>,
  name: string
): boolean {
  const deps = pkg.dependencies as Record<string, unknown> | undefined;
  const devDeps = pkg.devDependencies as Record<string, unknown> | undefined;
  return !!(deps?.[name] || devDeps?.[name]);
}

export async function detectTools(root: string): Promise<Detection[]> {
  const pf = await loadProjectFiles(root);
  const detections: Detection[] = [];

  const checks = [
    detectLanguage,
    detectPackageManager,
    detectLinter,
    detectFormatter,
    detectUnitTest,
    detectBdd,
    detectComplexity,
    detectSecurity,
    detectDepAudit,
    detectSecrets,
    detectDocTool,
    detectCommentStyle,
    detectDeadCode,
  ];

  for (const check of checks) {
    const results = await check(pf);
    detections.push(...results);
  }

  return detections;
}

// --- Detectors ---

async function detectLanguage(pf: ProjectFiles): Promise<Detection[]> {
  const results: Detection[] = [];

  if (pf.pkg) {
    const lang = (await fileExists(join(pf.root, "tsconfig.json")))
      ? "typescript"
      : "javascript";
    results.push({
      category: "language",
      name: lang,
      confidence: "high",
      signal: lang === "typescript" ? "tsconfig.json" : "package.json",
    });
  }

  if (
    pf.pyproject ||
    (await fileExists(join(pf.root, "requirements.txt"))) ||
    (await fileExists(join(pf.root, "setup.py")))
  ) {
    results.push({
      category: "language",
      name: "python",
      confidence: "high",
      signal: pf.pyproject ? "pyproject.toml" : "requirements.txt",
    });
  }

  if (await fileExists(join(pf.root, "go.mod"))) {
    results.push({
      category: "language",
      name: "go",
      confidence: "high",
      signal: "go.mod",
    });
  }

  if (await fileExists(join(pf.root, "Cargo.toml"))) {
    results.push({
      category: "language",
      name: "rust",
      confidence: "high",
      signal: "Cargo.toml",
    });
  }

  return results;
}

async function detectPackageManager(pf: ProjectFiles): Promise<Detection[]> {
  // Node
  if (await fileExists(join(pf.root, "pnpm-lock.yaml"))) {
    return [{ category: "package_manager", name: "pnpm", confidence: "high", signal: "pnpm-lock.yaml", command: "pnpm" }];
  }
  if (await fileExists(join(pf.root, "yarn.lock"))) {
    return [{ category: "package_manager", name: "yarn", confidence: "high", signal: "yarn.lock", command: "yarn" }];
  }
  if (await fileExists(join(pf.root, "package-lock.json"))) {
    return [{ category: "package_manager", name: "npm", confidence: "high", signal: "package-lock.json", command: "npm" }];
  }

  // Python
  if (await fileExists(join(pf.root, "uv.lock"))) {
    return [{ category: "package_manager", name: "uv", confidence: "high", signal: "uv.lock", command: "uv" }];
  }
  if (pf.pyproject?.includes("[tool.uv]")) {
    return [{ category: "package_manager", name: "uv", confidence: "high", signal: "[tool.uv] in pyproject.toml", command: "uv" }];
  }
  if (await fileExists(join(pf.root, "poetry.lock"))) {
    return [{ category: "package_manager", name: "poetry", confidence: "high", signal: "poetry.lock", command: "poetry" }];
  }
  if (pf.pyproject?.includes("[tool.poetry]")) {
    return [{ category: "package_manager", name: "poetry", confidence: "high", signal: "[tool.poetry] in pyproject.toml", command: "poetry" }];
  }
  if (await fileExists(join(pf.root, "Pipfile"))) {
    return [{ category: "package_manager", name: "pipenv", confidence: "high", signal: "Pipfile", command: "pipenv" }];
  }
  if (await fileExists(join(pf.root, "requirements.txt"))) {
    return [{ category: "package_manager", name: "pip", confidence: "medium", signal: "requirements.txt", command: "pip" }];
  }

  // Go / Rust
  if (await fileExists(join(pf.root, "go.mod"))) {
    return [{ category: "package_manager", name: "go", confidence: "high", signal: "go.mod", command: "go" }];
  }
  if (await fileExists(join(pf.root, "Cargo.toml"))) {
    return [{ category: "package_manager", name: "cargo", confidence: "high", signal: "Cargo.toml", command: "cargo" }];
  }

  return [];
}

async function detectLinter(pf: ProjectFiles): Promise<Detection[]> {
  for (const f of [
    "eslint.config.js", "eslint.config.mjs", "eslint.config.cjs",
    ".eslintrc.js", ".eslintrc.json", ".eslintrc.yaml", ".eslintrc.yml",
  ]) {
    if (await fileExists(join(pf.root, f))) {
      return [{ category: "lint", name: "eslint", confidence: "high", signal: f, command: "npx eslint ." }];
    }
  }

  if (await fileExists(join(pf.root, "biome.json"))) {
    return [{ category: "lint", name: "biome", confidence: "high", signal: "biome.json", command: "npx biome check ." }];
  }

  if (await fileExists(join(pf.root, "ruff.toml"))) {
    return [{ category: "lint", name: "ruff", confidence: "high", signal: "ruff.toml", command: "ruff check ." }];
  }
  if (pf.pyproject?.includes("[tool.ruff]")) {
    return [{ category: "lint", name: "ruff", confidence: "high", signal: "[tool.ruff] in pyproject.toml", command: "ruff check ." }];
  }

  if (await fileExists(join(pf.root, ".flake8"))) {
    return [{ category: "lint", name: "flake8", confidence: "high", signal: ".flake8", command: "flake8 ." }];
  }
  const setupCfg = await readFileOrNull(join(pf.root, "setup.cfg"));
  if (setupCfg?.includes("[flake8]")) {
    return [{ category: "lint", name: "flake8", confidence: "high", signal: "[flake8] in setup.cfg", command: "flake8 ." }];
  }

  return [];
}

async function detectFormatter(pf: ProjectFiles): Promise<Detection[]> {
  for (const f of [
    ".prettierrc", ".prettierrc.js", ".prettierrc.json",
    ".prettierrc.yaml", ".prettierrc.yml", "prettier.config.js", "prettier.config.cjs",
  ]) {
    if (await fileExists(join(pf.root, f))) {
      return [{ category: "format", name: "prettier", confidence: "high", signal: f, check_command: "npx prettier --check ." }];
    }
  }

  if (pf.pkg?.prettier) {
    return [{ category: "format", name: "prettier", confidence: "high", signal: "prettier key in package.json", check_command: "npx prettier --check ." }];
  }

  if (await fileExists(join(pf.root, "biome.json"))) {
    return [{ category: "format", name: "biome", confidence: "medium", signal: "biome.json", check_command: "npx biome format --check ." }];
  }

  if (pf.pyproject?.includes("[tool.black]")) {
    return [{ category: "format", name: "black", confidence: "high", signal: "[tool.black] in pyproject.toml", check_command: "black --check ." }];
  }

  if (pf.pyproject?.includes("[tool.ruff.format]") || pf.pyproject?.includes("[tool.ruff]")) {
    return [{ category: "format", name: "ruff", confidence: "medium", signal: "[tool.ruff] in pyproject.toml", check_command: "ruff format --check ." }];
  }

  return [];
}

async function detectUnitTest(pf: ProjectFiles): Promise<Detection[]> {
  for (const f of ["vitest.config.ts", "vitest.config.js", "vitest.config.mts"]) {
    if (await fileExists(join(pf.root, f))) {
      return [{ category: "unit_test", name: "vitest", confidence: "high", signal: f, command: "npx vitest run" }];
    }
  }
  if (pf.pkg && hasDep(pf.pkg, "vitest")) {
    return [{ category: "unit_test", name: "vitest", confidence: "high", signal: "vitest in dependencies", command: "npx vitest run" }];
  }

  for (const f of ["jest.config.js", "jest.config.ts", "jest.config.cjs"]) {
    if (await fileExists(join(pf.root, f))) {
      return [{ category: "unit_test", name: "jest", confidence: "high", signal: f, command: "npx jest" }];
    }
  }
  if (pf.pkg && hasDep(pf.pkg, "jest")) {
    return [{ category: "unit_test", name: "jest", confidence: "high", signal: "jest in dependencies", command: "npx jest" }];
  }

  if (await fileExists(join(pf.root, "pytest.ini"))) {
    return [{ category: "unit_test", name: "pytest", confidence: "high", signal: "pytest.ini", command: "pytest" }];
  }
  if (await fileExists(join(pf.root, "conftest.py"))) {
    return [{ category: "unit_test", name: "pytest", confidence: "high", signal: "conftest.py", command: "pytest" }];
  }
  if (pf.pyproject?.includes("[tool.pytest")) {
    return [{ category: "unit_test", name: "pytest", confidence: "high", signal: "[tool.pytest] in pyproject.toml", command: "pytest" }];
  }

  if (await fileExists(join(pf.root, "go.mod"))) {
    return [{ category: "unit_test", name: "go test", confidence: "medium", signal: "go.mod", command: "go test ./..." }];
  }

  return [];
}

async function detectBdd(pf: ProjectFiles): Promise<Detection[]> {
  const hasFeatures = await fileExists(join(pf.root, "features"));

  if (await fileExists(join(pf.root, "behave.ini"))) {
    return [{ category: "bdd_test", name: "behave", confidence: "high", signal: "behave.ini", command: "behave features/" }];
  }
  if (hasFeatures && (await fileExists(join(pf.root, "features", "steps")))) {
    return [{ category: "bdd_test", name: "behave", confidence: "medium", signal: "features/steps/ directory", command: "behave features/" }];
  }

  if (pf.pythonDeps.includes("pytest-bdd")) {
    return [{ category: "bdd_test", name: "pytest-bdd", confidence: "high", signal: "pytest-bdd in dependencies", command: "pytest --bdd" }];
  }

  if (pf.pkg && hasDep(pf.pkg, "@cucumber/cucumber")) {
    return [{ category: "bdd_test", name: "cucumber-js", confidence: "high", signal: "@cucumber/cucumber in dependencies", command: "npx cucumber-js" }];
  }

  if (pf.pkg && hasDep(pf.pkg, "playwright-bdd")) {
    return [{ category: "bdd_test", name: "playwright-bdd", confidence: "high", signal: "playwright-bdd in dependencies", command: "npx bddgen && npx playwright test" }];
  }

  return [];
}

async function detectComplexity(pf: ProjectFiles): Promise<Detection[]> {
  if (pf.pythonDeps.includes("radon")) {
    return [{ category: "complexity", name: "radon", confidence: "high", signal: "radon in dependencies", command: "radon cc . -a -nb" }];
  }

  if (pf.pkg && hasDep(pf.pkg, "eslint-plugin-complexity")) {
    return [{ category: "complexity", name: "eslint-complexity", confidence: "high", signal: "eslint-plugin-complexity in dependencies", command: "npx eslint --rule 'complexity: [warn, 10]' ." }];
  }

  return [];
}

async function detectSecurity(pf: ProjectFiles): Promise<Detection[]> {
  if (pf.pythonDeps.includes("bandit")) {
    return [{ category: "security", name: "bandit", confidence: "high", signal: "bandit in dependencies", command: "bandit -r ." }];
  }

  if (
    (await fileExists(join(pf.root, ".semgrep.yml"))) ||
    (await fileExists(join(pf.root, ".semgrep")))
  ) {
    return [{ category: "security", name: "semgrep", confidence: "high", signal: ".semgrep.yml", command: "semgrep scan ." }];
  }

  if (await fileExists(join(pf.root, "package-lock.json"))) {
    return [{ category: "security", name: "npm audit", confidence: "medium", signal: "npm project (builtin)", command: "npm audit" }];
  }

  return [];
}

async function detectDepAudit(pf: ProjectFiles): Promise<Detection[]> {
  if (await fileExists(join(pf.root, "package-lock.json"))) {
    return [{ category: "dep_audit", name: "npm audit", confidence: "high", signal: "package-lock.json", check_command: "npm audit --audit-level=high" }];
  }
  if (await fileExists(join(pf.root, "yarn.lock"))) {
    return [{ category: "dep_audit", name: "yarn audit", confidence: "high", signal: "yarn.lock", check_command: "yarn audit --level high" }];
  }
  if (await fileExists(join(pf.root, "pnpm-lock.yaml"))) {
    return [{ category: "dep_audit", name: "pnpm audit", confidence: "high", signal: "pnpm-lock.yaml", check_command: "pnpm audit --audit-level=high" }];
  }

  if (pf.pythonDeps.includes("pip-audit")) {
    return [{ category: "dep_audit", name: "pip-audit", confidence: "high", signal: "pip-audit in dependencies", check_command: "pip-audit" }];
  }

  if (pf.pythonDeps.includes("safety")) {
    return [{ category: "dep_audit", name: "safety", confidence: "high", signal: "safety in dependencies", check_command: "safety check" }];
  }

  if (pf.pyproject || (await fileExists(join(pf.root, "requirements.txt")))) {
    return [{ category: "dep_audit", name: "pip-audit", confidence: "low", signal: "Python project (pip-audit recommended)", check_command: "pip-audit" }];
  }

  return [];
}

async function detectSecrets(pf: ProjectFiles): Promise<Detection[]> {
  if (await fileExists(join(pf.root, ".secrets.baseline"))) {
    return [{ category: "secrets", name: "detect-secrets", confidence: "high", signal: ".secrets.baseline", check_command: "detect-secrets scan --baseline .secrets.baseline" }];
  }
  if (await fileExists(join(pf.root, ".gitleaks.toml"))) {
    return [{ category: "secrets", name: "gitleaks", confidence: "high", signal: ".gitleaks.toml", check_command: "gitleaks detect --no-git" }];
  }
  if (await fileExists(join(pf.root, ".trufflehog.yml"))) {
    return [{ category: "secrets", name: "trufflehog", confidence: "high", signal: ".trufflehog.yml", check_command: "trufflehog filesystem . --no-update" }];
  }

  return [];
}

async function detectDocTool(pf: ProjectFiles): Promise<Detection[]> {
  if (
    (await fileExists(join(pf.root, "docs", "conf.py"))) ||
    (await fileExists(join(pf.root, "doc", "conf.py")))
  ) {
    return [{ category: "doc_tool", name: "sphinx", confidence: "high", signal: "docs/conf.py" }];
  }

  if (await fileExists(join(pf.root, "mkdocs.yml"))) {
    return [{ category: "doc_tool", name: "mkdocs", confidence: "high", signal: "mkdocs.yml" }];
  }

  if (pf.pkg && hasDep(pf.pkg, "typedoc")) {
    return [{ category: "doc_tool", name: "typedoc", confidence: "high", signal: "typedoc in dependencies" }];
  }

  if (await fileExists(join(pf.root, "jsdoc.json"))) {
    return [{ category: "doc_tool", name: "jsdoc", confidence: "high", signal: "jsdoc.json" }];
  }
  if (pf.pkg && hasDep(pf.pkg, "jsdoc")) {
    return [{ category: "doc_tool", name: "jsdoc", confidence: "medium", signal: "jsdoc in dependencies" }];
  }

  if (await fileExists(join(pf.root, "Cargo.toml"))) {
    return [{ category: "doc_tool", name: "rustdoc", confidence: "medium", signal: "Cargo.toml (builtin)" }];
  }

  if (await fileExists(join(pf.root, "go.mod"))) {
    return [{ category: "doc_tool", name: "godoc", confidence: "medium", signal: "go.mod (builtin)" }];
  }

  return [];
}

async function detectDeadCode(pf: ProjectFiles): Promise<Detection[]> {
  // Knip (JS/TS) — finds unused files, exports, dependencies, and types
  if (pf.pkg && hasDep(pf.pkg, "knip")) {
    return [{ category: "dead_code", name: "knip", confidence: "high", signal: "knip in dependencies", command: "npx knip" }];
  }
  if (await fileExists(join(pf.root, "knip.json"))) {
    return [{ category: "dead_code", name: "knip", confidence: "high", signal: "knip.json", command: "npx knip" }];
  }
  if (await fileExists(join(pf.root, "knip.ts"))) {
    return [{ category: "dead_code", name: "knip", confidence: "high", signal: "knip.ts", command: "npx knip" }];
  }

  // ts-prune (TypeScript unused exports)
  if (pf.pkg && hasDep(pf.pkg, "ts-prune")) {
    return [{ category: "dead_code", name: "ts-prune", confidence: "high", signal: "ts-prune in dependencies", command: "npx ts-prune" }];
  }

  // Vulture (Python)
  if (pf.pythonDeps.includes("vulture")) {
    return [{ category: "dead_code", name: "vulture", confidence: "high", signal: "vulture in dependencies", command: "vulture ." }];
  }

  // deadcode (Go)
  if (await fileExists(join(pf.root, "go.mod"))) {
    // deadcode is a golang.org/x tool, check if it's likely available
    return [{ category: "dead_code", name: "deadcode", confidence: "low", signal: "go.mod (golang.org/x/tools)", command: "deadcode ./..." }];
  }

  // Fallback: if JS/TS project, recommend knip
  if (pf.pkg) {
    return [{ category: "dead_code", name: "knip", confidence: "low", signal: "JS/TS project (knip recommended)", command: "npx knip" }];
  }

  // Fallback: if Python project, recommend vulture
  if (pf.pyproject || pf.pythonDeps) {
    return [{ category: "dead_code", name: "vulture", confidence: "low", signal: "Python project (vulture recommended)", command: "vulture ." }];
  }

  return [];
}

async function detectCommentStyle(pf: ProjectFiles): Promise<Detection[]> {
  if (pf.pyproject?.includes('convention = "google"')) {
    return [{ category: "comment_style", name: "google", confidence: "high", signal: 'convention = "google" in pyproject.toml' }];
  }
  if (pf.pyproject?.includes('convention = "numpy"')) {
    return [{ category: "comment_style", name: "numpy", confidence: "high", signal: 'convention = "numpy" in pyproject.toml' }];
  }
  if (pf.pyproject?.includes('convention = "pep257"')) {
    return [{ category: "comment_style", name: "pep257", confidence: "high", signal: 'convention = "pep257" in pyproject.toml' }];
  }

  if (
    (await fileExists(join(pf.root, "docs", "conf.py"))) ||
    (await fileExists(join(pf.root, "doc", "conf.py")))
  ) {
    return [{ category: "comment_style", name: "sphinx", confidence: "medium", signal: "sphinx docs present" }];
  }

  if (pf.pkg && (hasDep(pf.pkg, "typedoc") || hasDep(pf.pkg, "jsdoc"))) {
    const name = hasDep(pf.pkg, "typedoc") ? "tsdoc" : "jsdoc";
    return [{ category: "comment_style", name, confidence: "medium", signal: `${name === "tsdoc" ? "typedoc" : "jsdoc"} in dependencies` }];
  }

  return [];
}
