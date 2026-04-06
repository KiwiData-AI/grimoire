import { join, resolve } from "node:path";
import { fileExists } from "./fs.js";

/**
 * Walk up from cwd to find a directory containing .grimoire/ or features/
 */
export async function findProjectRoot(): Promise<string> {
  let dir = process.cwd();
  const root = resolve("/");

  while (dir !== root) {
    if (
      (await fileExists(join(dir, ".grimoire"))) ||
      (await fileExists(join(dir, "features")))
    ) {
      return dir;
    }
    dir = resolve(dir, "..");
  }

  // Fall back to cwd
  return process.cwd();
}

export function resolveChangePath(root: string, changeId: string): string {
  return join(root, ".grimoire", "changes", changeId);
}
