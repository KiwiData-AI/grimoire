import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";

const REGISTER_PATH = ".grimoire/security/accepted-risks.yml";

// Advisory id patterns scanners print: CVE-2026-12345, GHSA-xxxx-xxxx-xxxx.
const ADVISORY_ID = /\b(?:CVE-\d{4}-\d{3,}|GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})\b/gi;

interface AcceptedEntry {
  cve?: string;
  aliases?: string[];
  expires?: string;
}

/**
 * Load the set of advisory ids (CVE/GHSA, upper-cased) that are currently
 * risk-accepted and NOT expired. Returns an empty set if the register is
 * missing, empty, or unparseable — fail-safe: no register means no suppression.
 */
export async function loadAcceptedRiskIds(root: string, now: Date): Promise<Set<string>> {
  const ids = new Set<string>();
  let raw: string;
  try {
    raw = await readFile(join(root, REGISTER_PATH), "utf8");
  } catch {
    return ids;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch {
    return ids;
  }

  const entries = (parsed as { accepted?: AcceptedEntry[] })?.accepted;
  if (!Array.isArray(entries)) return ids;

  for (const entry of entries) {
    if (!isExpired(entry.expires, now)) collectEntryIds(entry, ids);
  }
  return ids;
}

function collectEntryIds(entry: AcceptedEntry, ids: Set<string>): void {
  for (const id of [entry.cve, ...(entry.aliases ?? [])]) {
    if (typeof id === "string" && id.trim()) ids.add(id.trim().toUpperCase());
  }
}

// Fail-safe: this gate suppresses security findings, so a missing or malformed
// `expires` must NOT grant a permanent silent pass. An entry only suppresses
// while it carries a valid date still in the future; anything else re-surfaces
// the advisory. `expires` is the first day the suppression is no longer honored
// (comparison is at UTC midnight of that date).
function isExpired(expires: string | undefined, now: Date): boolean {
  if (!expires) return true; // no expiry on a gate-bypass entry → don't suppress
  const when = new Date(expires);
  if (Number.isNaN(when.getTime())) return true; // malformed date → fail safe
  return now > when;
}

export interface RegisterSuppression {
  suppressed: string[]; // accepted ids found in the output
  remaining: string[]; // advisory ids in the output NOT covered by the register
}

/**
 * Given scanner output text, partition the advisory ids it mentions into those
 * suppressed by the register and those still outstanding. Scanner-agnostic:
 * works on any tool that prints CVE/GHSA ids (npm audit, pip-audit, osv, ...).
 */
export function partitionAdvisories(output: string, acceptedIds: Set<string>): RegisterSuppression {
  const found = new Set<string>();
  for (const match of output.matchAll(ADVISORY_ID)) {
    found.add(match[0].toUpperCase());
  }
  const suppressed: string[] = [];
  const remaining: string[] = [];
  for (const id of found) {
    (acceptedIds.has(id) ? suppressed : remaining).push(id);
  }
  return { suppressed, remaining };
}
