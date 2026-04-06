import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { fileExists, readFileOrNull, escapeRegex } from "./fs.js";

const TMP = join(import.meta.dirname, "../../.test-tmp");

describe("fileExists", () => {
  it("returns true for existing file", async () => {
    await mkdir(TMP, { recursive: true });
    const p = join(TMP, "exists.txt");
    await writeFile(p, "hello");

    expect(await fileExists(p)).toBe(true);

    await rm(TMP, { recursive: true });
  });

  it("returns false for missing file", async () => {
    expect(await fileExists(join(TMP, "nope.txt"))).toBe(false);
  });
});

describe("readFileOrNull", () => {
  it("reads an existing file", async () => {
    await mkdir(TMP, { recursive: true });
    const p = join(TMP, "read.txt");
    await writeFile(p, "content");

    expect(await readFileOrNull(p)).toBe("content");

    await rm(TMP, { recursive: true });
  });

  it("returns null for missing file", async () => {
    expect(await readFileOrNull(join(TMP, "nope.txt"))).toBeNull();
  });
});

describe("escapeRegex", () => {
  it("escapes special regex characters", () => {
    expect(escapeRegex("hello.world")).toBe("hello\\.world");
    expect(escapeRegex("a+b*c?")).toBe("a\\+b\\*c\\?");
    expect(escapeRegex("[foo](bar)")).toBe("\\[foo\\]\\(bar\\)");
    expect(escapeRegex("$100")).toBe("\\$100");
  });

  it("leaves plain strings unchanged", () => {
    expect(escapeRegex("hello")).toBe("hello");
    expect(escapeRegex("abc123")).toBe("abc123");
  });
});
