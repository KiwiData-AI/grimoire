import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateCompressedMap, extractSymbols, type SymbolInfo } from "./symbols.js";

vi.mock("fast-glob", () => ({ default: vi.fn().mockResolvedValue([]) }));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, readFile: vi.fn() };
});

import fg from "fast-glob";
import { readFile } from "node:fs/promises";

const mockGlob = vi.mocked(fg);
const mockReadFile = vi.mocked(readFile);

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe("extractSymbols", () => {
  it("extracts Python functions, classes, and methods", async () => {
    mockGlob.mockResolvedValue(["/root/src/app.py"] as any);
    mockReadFile.mockResolvedValue(`
def greet(name: str) -> str:
    return f"Hello, {name}"

async def fetch_data(url: str) -> dict:
    pass

class UserService(BaseService):
    def get_user(self, user_id: int) -> User:
        pass
    def _private(self):
        pass

MAX_RETRIES: int = 3
` as any);

    const result = await extractSymbols("/root", new Set());
    expect(result.fileCount).toBe(1);

    const names = result.symbols.map((s) => s.name);
    expect(names).toContain("greet");
    expect(names).toContain("fetch_data");
    expect(names).toContain("UserService");
    expect(names).toContain("UserService.get_user");
    expect(names).toContain("MAX_RETRIES");
    // Private methods should be excluded
    expect(names).not.toContain("UserService._private");

    const greet = result.symbols.find((s) => s.name === "greet");
    expect(greet?.kind).toBe("function");
    expect(greet?.signature).toContain("-> str");

    const fetchData = result.symbols.find((s) => s.name === "fetch_data");
    expect(fetchData?.signature).toContain("async def");
  });

  it("extracts TypeScript/JS exports, classes, types", async () => {
    mockGlob.mockResolvedValue(["/root/src/api.ts"] as any);
    mockReadFile.mockResolvedValue(`
export async function fetchUsers(page: number): Promise<User[]> {
  return [];
}

function internalHelper() {
  return true;
}

export const createUser = async (data: UserData) => {
  return {};
};

export class UserController extends BaseController {
  getUser() {}
}

export interface UserData {
  name: string;
}

export type UserId = string;

export const MAX_PAGE_SIZE = 100;
` as any);

    const result = await extractSymbols("/root", new Set());
    const names = result.symbols.map((s) => s.name);

    expect(names).toContain("fetchUsers");
    expect(names).toContain("internalHelper");
    expect(names).toContain("createUser");
    expect(names).toContain("UserController");
    expect(names).toContain("UserData");
    expect(names).toContain("UserId");
    expect(names).toContain("MAX_PAGE_SIZE");

    const fetchUsers = result.symbols.find((s) => s.name === "fetchUsers");
    expect(fetchUsers?.kind).toBe("export");

    const helper = result.symbols.find((s) => s.name === "internalHelper");
    expect(helper?.kind).toBe("function");

    const iface = result.symbols.find((s) => s.name === "UserData");
    expect(iface?.kind).toBe("type");
  });

  it("extracts Go functions, methods, structs, interfaces", async () => {
    mockGlob.mockResolvedValue(["/root/main.go"] as any);
    mockReadFile.mockResolvedValue(`
func HandleRequest(w http.ResponseWriter, r *http.Request) {
}

func (s *Server) Start(port int) error {
}

type Server struct {
}

type Handler interface {
}
` as any);

    const result = await extractSymbols("/root", new Set());
    const names = result.symbols.map((s) => s.name);

    expect(names).toContain("HandleRequest");
    expect(names).toContain("Server.Start");
    expect(names).toContain("Server");

    const handleReq = result.symbols.find((s) => s.name === "HandleRequest");
    expect(handleReq?.kind).toBe("export"); // capitalized = exported in Go

    const handler = result.symbols.find((s) => s.name === "Handler");
    expect(handler?.kind).toBe("type");
  });

  it("extracts Rust public items", async () => {
    mockGlob.mockResolvedValue(["/root/src/lib.rs"] as any);
    mockReadFile.mockResolvedValue(`
pub fn process(input: &str) -> Result<Output, Error> {
}

pub async fn fetch(url: &str) -> Result<Response> {
}

pub struct Config {
}

pub trait Processor {
}

pub enum Status {
}
` as any);

    const result = await extractSymbols("/root", new Set());
    const names = result.symbols.map((s) => s.name);

    expect(names).toContain("process");
    expect(names).toContain("fetch");
    expect(names).toContain("Config");
    expect(names).toContain("Processor");
    expect(names).toContain("Status");

    const process = result.symbols.find((s) => s.name === "process");
    expect(process?.kind).toBe("export");
    expect(process?.signature).toContain("-> Result<Output, Error>");
  });

  it("returns empty for no matching files", async () => {
    mockGlob.mockResolvedValue([] as any);
    const result = await extractSymbols("/root", new Set());
    expect(result.symbols).toHaveLength(0);
    expect(result.fileCount).toBe(0);
  });

  it("passes ignore patterns to glob", async () => {
    mockGlob.mockResolvedValue([] as any);
    await extractSymbols("/root", new Set(["vendor", "generated"]));

    const globOpts = mockGlob.mock.calls[0][1] as any;
    expect(globOpts.ignore).toContain("**/vendor/**");
    expect(globOpts.ignore).toContain("**/generated/**");
  });
});
