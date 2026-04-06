import { access, readFile } from "node:fs/promises";
import fg from "fast-glob";

/**
 * Check if a path exists (file or directory).
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a file, returning null if it doesn't exist or can't be read.
 */
export async function readFileOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Escape a string for use in a RegExp constructor.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find files matching a glob extension pattern under a directory.
 */
export async function findFiles(dir: string, ext: string): Promise<string[]> {
  return fg(`**/*${ext}`, { cwd: dir, absolute: true });
}
