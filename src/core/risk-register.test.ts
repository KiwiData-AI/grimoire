import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAcceptedRiskIds, partitionAdvisories } from "./risk-register.js";

const NOW = new Date("2026-06-04T00:00:00Z");

describe("loadAcceptedRiskIds", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "grimoire-risk-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function writeRegister(yaml: string) {
    const dir = join(root, ".grimoire/security");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "accepted-risks.yml"), yaml);
  }

  it("returns an empty set when the register is missing", async () => {
    const ids = await loadAcceptedRiskIds(root, NOW);
    expect(ids.size).toBe(0);
  });

  it("returns an empty set on unparseable YAML", async () => {
    await writeRegister(":\n  - [unbalanced");
    const ids = await loadAcceptedRiskIds(root, NOW);
    expect(ids.size).toBe(0);
  });

  it("collects cve and aliases, upper-cased", async () => {
    await writeRegister(`accepted:
  - cve: GHSA-5xrq-8626-4rwp
    aliases: [CVE-2026-1111]
    expires: 2026-09-04
`);
    const ids = await loadAcceptedRiskIds(root, NOW);
    expect(ids.has("GHSA-5XRQ-8626-4RWP")).toBe(true);
    expect(ids.has("CVE-2026-1111")).toBe(true);
  });

  it("excludes expired entries", async () => {
    await writeRegister(`accepted:
  - cve: CVE-2026-2222
    expires: 2026-05-01
`);
    const ids = await loadAcceptedRiskIds(root, NOW);
    expect(ids.has("CVE-2026-2222")).toBe(false);
  });

  it("excludes entries with no expiry (fail-safe — a gate-bypass must declare one)", async () => {
    await writeRegister(`accepted:
  - cve: CVE-2026-3333
`);
    const ids = await loadAcceptedRiskIds(root, NOW);
    expect(ids.has("CVE-2026-3333")).toBe(false);
  });

  it("excludes entries with a malformed expiry (fail-safe)", async () => {
    await writeRegister(`accepted:
  - cve: CVE-2026-4444
    expires: not-a-date
`);
    const ids = await loadAcceptedRiskIds(root, NOW);
    expect(ids.has("CVE-2026-4444")).toBe(false);
  });

  it("returns empty set when accepted is not a list", async () => {
    await writeRegister(`accepted: none`);
    const ids = await loadAcceptedRiskIds(root, NOW);
    expect(ids.size).toBe(0);
  });
});

describe("partitionAdvisories", () => {
  const accepted = new Set(["GHSA-5XRQ-8626-4RWP", "CVE-2026-1111"]);

  it("extracts ids from npm-audit-style output (advisory URL) and suppresses accepted", () => {
    const output = "critical ... https://github.com/advisories/GHSA-5xrq-8626-4rwp";
    const { suppressed, remaining } = partitionAdvisories(output, accepted);
    expect(suppressed).toEqual(["GHSA-5XRQ-8626-4RWP"]);
    expect(remaining).toEqual([]);
  });

  it("leaves un-accepted advisories outstanding", () => {
    const output = "CVE-2026-1111 and CVE-2026-9999 found";
    const { suppressed, remaining } = partitionAdvisories(output, accepted);
    expect(suppressed).toContain("CVE-2026-1111");
    expect(remaining).toContain("CVE-2026-9999");
  });

  it("returns empty partitions when output has no advisory ids", () => {
    const { suppressed, remaining } = partitionAdvisories("all clean", accepted);
    expect(suppressed).toEqual([]);
    expect(remaining).toEqual([]);
  });
});
