import { readFile } from "node:fs/promises";
import { extname, relative } from "node:path";
import fg from "fast-glob";

export interface SymbolInfo {
  file: string;
  name: string;
  kind: "function" | "class" | "method" | "export" | "type" | "constant";
  signature: string;
  line: number;
}

export interface SymbolMap {
  symbols: SymbolInfo[];
  fileCount: number;
}

/**
 * Extract symbols (function signatures, class definitions, exports) from source files
 * using regex-based parsing. Covers Python, TypeScript, JavaScript, Go, and Rust.
 *
 * This is a lightweight alternative to full tree-sitter parsing that requires
 * no native dependencies. It extracts the "API surface" — what an LLM needs
 * to know to use existing code without reading full source files.
 */
export async function extractSymbols(
  root: string,
  ignorePatterns: Set<string>
): Promise<SymbolMap> {
  const ignoreGlobs = [...ignorePatterns].map((p) => `**/${p}/**`);

  const files = await fg(
    ["**/*.py", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.go", "**/*.rs"],
    {
      cwd: root,
      absolute: true,
      ignore: [
        ...ignoreGlobs,
        "**/node_modules/**",
        "**/.venv/**",
        "**/dist/**",
        "**/build/**",
        "**/__pycache__/**",
      ],
    }
  );

  const symbols: SymbolInfo[] = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8");
    const relPath = relative(root, filePath);
    const ext = extname(filePath);
    const lines = content.split("\n");

    let fileSymbols: SymbolInfo[];
    switch (ext) {
      case ".py":
        fileSymbols = extractPythonSymbols(relPath, lines);
        break;
      case ".ts":
      case ".tsx":
      case ".js":
      case ".jsx":
        fileSymbols = extractJsSymbols(relPath, lines);
        break;
      case ".go":
        fileSymbols = extractGoSymbols(relPath, lines);
        break;
      case ".rs":
        fileSymbols = extractRustSymbols(relPath, lines);
        break;
      default:
        fileSymbols = [];
    }

    symbols.push(...fileSymbols);
  }

  return { symbols, fileCount: files.length };
}

// --- Python ---

function extractPythonSymbols(file: string, lines: string[]): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Top-level functions
    const fnMatch = line.match(/^def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(.+?))?\s*:/);
    if (fnMatch) {
      const returnType = fnMatch[3] ? ` -> ${fnMatch[3].trim()}` : "";
      symbols.push({
        file,
        name: fnMatch[1],
        kind: "function",
        signature: `def ${fnMatch[1]}(${fnMatch[2].trim()})${returnType}`,
        line: i + 1,
      });
      continue;
    }

    // Top-level async functions
    const asyncFnMatch = line.match(/^async\s+def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(.+?))?\s*:/);
    if (asyncFnMatch) {
      const returnType = asyncFnMatch[3] ? ` -> ${asyncFnMatch[3].trim()}` : "";
      symbols.push({
        file,
        name: asyncFnMatch[1],
        kind: "function",
        signature: `async def ${asyncFnMatch[1]}(${asyncFnMatch[2].trim()})${returnType}`,
        line: i + 1,
      });
      continue;
    }

    // Classes
    const classMatch = line.match(/^class\s+(\w+)(?:\(([^)]*)\))?\s*:/);
    if (classMatch) {
      const bases = classMatch[2] ? `(${classMatch[2].trim()})` : "";
      symbols.push({
        file,
        name: classMatch[1],
        kind: "class",
        signature: `class ${classMatch[1]}${bases}`,
        line: i + 1,
      });

      // Extract methods of this class
      for (let j = i + 1; j < lines.length; j++) {
        const methodLine = lines[j];
        if (methodLine.match(/^\S/) && methodLine.trim() !== "") break; // Left indent — class ended
        const methodMatch = methodLine.match(
          /^\s+(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(.+?))?\s*:/
        );
        if (methodMatch && !methodMatch[1].startsWith("_")) {
          const isAsync = methodLine.includes("async def");
          const returnType = methodMatch[3] ? ` -> ${methodMatch[3].trim()}` : "";
          const prefix = isAsync ? "async def" : "def";
          symbols.push({
            file,
            name: `${classMatch[1]}.${methodMatch[1]}`,
            kind: "method",
            signature: `${prefix} ${methodMatch[1]}(${methodMatch[2].trim()})${returnType}`,
            line: j + 1,
          });
        }
      }
      continue;
    }

    // Module-level constants (ALL_CAPS)
    const constMatch = line.match(/^([A-Z][A-Z0-9_]+)\s*(?::\s*\w+\s*)?=/);
    if (constMatch) {
      symbols.push({
        file,
        name: constMatch[1],
        kind: "constant",
        signature: line.trim().slice(0, 80),
        line: i + 1,
      });
    }
  }

  return symbols;
}

// --- JavaScript/TypeScript ---

function extractJsSymbols(file: string, lines: string[]): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Exported functions
    const exportFnMatch = line.match(
      /^export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*(.+?))?\s*\{/
    );
    if (exportFnMatch) {
      const returnType = exportFnMatch[3] ? `: ${exportFnMatch[3].trim()}` : "";
      symbols.push({
        file,
        name: exportFnMatch[1],
        kind: "export",
        signature: `export function ${exportFnMatch[1]}(${exportFnMatch[2].trim()})${returnType}`,
        line: i + 1,
      });
      continue;
    }

    // Non-exported functions
    const fnMatch = line.match(
      /^(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*(.+?))?\s*\{/
    );
    if (fnMatch) {
      const returnType = fnMatch[3] ? `: ${fnMatch[3].trim()}` : "";
      symbols.push({
        file,
        name: fnMatch[1],
        kind: "function",
        signature: `function ${fnMatch[1]}(${fnMatch[2].trim()})${returnType}`,
        line: i + 1,
      });
      continue;
    }

    // Arrow function exports
    const arrowMatch = line.match(
      /^export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(/
    );
    if (arrowMatch) {
      symbols.push({
        file,
        name: arrowMatch[1],
        kind: "export",
        signature: line.trim().replace(/\s*\{.*$/, "").slice(0, 100),
        line: i + 1,
      });
      continue;
    }

    // Classes
    const classMatch = line.match(
      /^export\s+(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+(.+?))?\s*\{/
    );
    if (classMatch) {
      const ext = classMatch[2] ? ` extends ${classMatch[2]}` : "";
      const impl = classMatch[3] ? ` implements ${classMatch[3].trim()}` : "";
      symbols.push({
        file,
        name: classMatch[1],
        kind: "class",
        signature: `export class ${classMatch[1]}${ext}${impl}`,
        line: i + 1,
      });
      continue;
    }

    // Interfaces and types
    const typeMatch = line.match(
      /^export\s+(?:interface|type)\s+(\w+)(?:<[^>]*>)?/
    );
    if (typeMatch) {
      symbols.push({
        file,
        name: typeMatch[1],
        kind: "type",
        signature: line.trim().replace(/\s*\{.*$/, "").replace(/\s*=.*$/, "").slice(0, 100),
        line: i + 1,
      });
      continue;
    }

    // Exported constants
    const constMatch = line.match(/^export\s+const\s+(\w+)\s*(?::\s*([^=]+))?\s*=/);
    if (constMatch && !arrowMatch) {
      symbols.push({
        file,
        name: constMatch[1],
        kind: "constant",
        signature: line.trim().replace(/\s*=.*$/, "").slice(0, 80),
        line: i + 1,
      });
    }
  }

  return symbols;
}

// --- Go ---

function extractGoSymbols(file: string, lines: string[]): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Functions (exported = capitalized)
    const fnMatch = line.match(/^func\s+(\w+)\s*\(([^)]*)\)(?:\s*(.+?))?\s*\{/);
    if (fnMatch) {
      const returnType = fnMatch[3] ? ` ${fnMatch[3].trim()}` : "";
      symbols.push({
        file,
        name: fnMatch[1],
        kind: fnMatch[1][0] === fnMatch[1][0].toUpperCase() ? "export" : "function",
        signature: `func ${fnMatch[1]}(${fnMatch[2].trim()})${returnType}`,
        line: i + 1,
      });
      continue;
    }

    // Methods
    const methodMatch = line.match(
      /^func\s+\((\w+)\s+\*?(\w+)\)\s+(\w+)\s*\(([^)]*)\)(?:\s*(.+?))?\s*\{/
    );
    if (methodMatch) {
      const returnType = methodMatch[5] ? ` ${methodMatch[5].trim()}` : "";
      symbols.push({
        file,
        name: `${methodMatch[2]}.${methodMatch[3]}`,
        kind: "method",
        signature: `func (${methodMatch[1]} *${methodMatch[2]}) ${methodMatch[3]}(${methodMatch[4].trim()})${returnType}`,
        line: i + 1,
      });
      continue;
    }

    // Structs
    const structMatch = line.match(/^type\s+(\w+)\s+struct\s*\{/);
    if (structMatch) {
      symbols.push({
        file,
        name: structMatch[1],
        kind: "class",
        signature: `type ${structMatch[1]} struct`,
        line: i + 1,
      });
    }

    // Interfaces
    const ifaceMatch = line.match(/^type\s+(\w+)\s+interface\s*\{/);
    if (ifaceMatch) {
      symbols.push({
        file,
        name: ifaceMatch[1],
        kind: "type",
        signature: `type ${ifaceMatch[1]} interface`,
        line: i + 1,
      });
    }
  }

  return symbols;
}

// --- Rust ---

function extractRustSymbols(file: string, lines: string[]): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Public functions
    const fnMatch = line.match(
      /^pub(?:\s+async)?\s+fn\s+(\w+)(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*(.+?))?\s*(?:\{|where)/
    );
    if (fnMatch) {
      const returnType = fnMatch[3] ? ` -> ${fnMatch[3].trim()}` : "";
      symbols.push({
        file,
        name: fnMatch[1],
        kind: "export",
        signature: `pub fn ${fnMatch[1]}(${fnMatch[2].trim()})${returnType}`,
        line: i + 1,
      });
      continue;
    }

    // Structs
    const structMatch = line.match(/^pub\s+struct\s+(\w+)(?:<[^>]*>)?/);
    if (structMatch) {
      symbols.push({
        file,
        name: structMatch[1],
        kind: "class",
        signature: line.trim().replace(/\s*\{.*$/, "").slice(0, 100),
        line: i + 1,
      });
      continue;
    }

    // Traits
    const traitMatch = line.match(/^pub\s+trait\s+(\w+)(?:<[^>]*>)?/);
    if (traitMatch) {
      symbols.push({
        file,
        name: traitMatch[1],
        kind: "type",
        signature: line.trim().replace(/\s*\{.*$/, "").slice(0, 100),
        line: i + 1,
      });
      continue;
    }

    // Enums
    const enumMatch = line.match(/^pub\s+enum\s+(\w+)(?:<[^>]*>)?/);
    if (enumMatch) {
      symbols.push({
        file,
        name: enumMatch[1],
        kind: "type",
        signature: line.trim().replace(/\s*\{.*$/, "").slice(0, 100),
        line: i + 1,
      });
    }
  }

  return symbols;
}

/**
 * Generate a compressed "repomix-style" representation of the codebase.
 * Includes file headers with symbol signatures only (no function bodies).
 * This is a compact representation that fits in an LLM context window.
 */
export function generateCompressedMap(
  symbols: SymbolInfo[],
  root: string
): string {
  const byFile = new Map<string, SymbolInfo[]>();
  for (const sym of symbols) {
    if (!byFile.has(sym.file)) byFile.set(sym.file, []);
    byFile.get(sym.file)!.push(sym);
  }

  const lines: string[] = [
    "# Codebase Symbol Map",
    `# Generated: ${new Date().toISOString()}`,
    `# Files: ${byFile.size}`,
    `# Symbols: ${symbols.length}`,
    "",
  ];

  // Sort files for consistent output
  const sortedFiles = [...byFile.keys()].sort();

  for (const file of sortedFiles) {
    const fileSymbols = byFile.get(file)!;
    lines.push(`## ${file}`);
    for (const sym of fileSymbols) {
      lines.push(`  L${sym.line} ${sym.kind}: ${sym.signature}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
