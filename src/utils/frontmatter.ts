import { parse } from "yaml";

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/;

// Parse leading YAML frontmatter; empty data when absent.
export function matter(input: string): ParsedFrontmatter {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const match = FRONTMATTER.exec(text);
  if (!match) return { data: {}, content: text };
  const parsed = match[1].trim() ? parse(match[1]) : null;
  const data = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  return { data, content: match[2] ?? "" };
}
