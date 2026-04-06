import { describe, it, expect } from "vitest";
import { generateCompressedMap, type SymbolInfo } from "./symbols.js";

// We test the internal extraction functions through the public API signatures
// and the compressed map generator directly.

function makeSymbol(overrides: Partial<SymbolInfo> = {}): SymbolInfo {
  return {
    file: "src/app.ts",
    name: "doStuff",
    kind: "function",
    signature: "function doStuff(x: number): void",
    line: 1,
    ...overrides,
  };
}

describe("generateCompressedMap", () => {
  it("renders symbols grouped by file", () => {
    const symbols: SymbolInfo[] = [
      makeSymbol({ file: "src/a.ts", name: "foo", line: 5, signature: "function foo()" }),
      makeSymbol({ file: "src/a.ts", name: "bar", line: 10, signature: "function bar()" }),
      makeSymbol({ file: "src/b.ts", name: "Baz", kind: "class", line: 1, signature: "export class Baz" }),
    ];

    const result = generateCompressedMap(symbols, "/project");

    expect(result).toContain("## src/a.ts");
    expect(result).toContain("## src/b.ts");
    expect(result).toContain("L5 function: function foo()");
    expect(result).toContain("L10 function: function bar()");
    expect(result).toContain("L1 class: export class Baz");
  });

  it("sorts files alphabetically", () => {
    const symbols: SymbolInfo[] = [
      makeSymbol({ file: "src/z.ts" }),
      makeSymbol({ file: "src/a.ts" }),
    ];

    const result = generateCompressedMap(symbols, "/project");
    const aIndex = result.indexOf("src/a.ts");
    const zIndex = result.indexOf("src/z.ts");
    expect(aIndex).toBeLessThan(zIndex);
  });

  it("includes header with counts", () => {
    const symbols: SymbolInfo[] = [
      makeSymbol({ file: "src/a.ts" }),
      makeSymbol({ file: "src/b.ts" }),
    ];

    const result = generateCompressedMap(symbols, "/project");
    expect(result).toContain("# Files: 2");
    expect(result).toContain("# Symbols: 2");
  });

  it("handles empty symbols array", () => {
    const result = generateCompressedMap([], "/project");
    expect(result).toContain("# Files: 0");
    expect(result).toContain("# Symbols: 0");
  });
});
