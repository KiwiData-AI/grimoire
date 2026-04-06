import { Command } from "commander";
import { generateDocs } from "../core/docs.js";

export const docsCommand = new Command("docs")
  .description(
    "Generate a human-readable project overview from grimoire artifacts"
  )
  .option("-o, --output <path>", "Output file path (default: .grimoire/docs/OVERVIEW.md)")
  .action(async (options) => {
    await generateDocs({
      output: options.output,
    });
  });
