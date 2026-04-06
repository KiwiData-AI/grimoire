import { Command } from "commander";
import { generatePr } from "../core/pr.js";

export const prCommand = new Command("pr")
  .description("Generate PR description from grimoire change artifacts")
  .argument("[change-id]", "Change to generate PR for (default: auto-detect)")
  .option("--create", "Create PR via gh/glab (default: preview only)")
  .option("--review", "Run post-implementation LLM review on the diff")
  .option("--json", "Output as JSON")
  .action(async (changeId: string | undefined, options) => {
    await generatePr({
      changeId,
      create: options.create ?? false,
      review: options.review ?? false,
      json: options.json ?? false,
    });
  });
