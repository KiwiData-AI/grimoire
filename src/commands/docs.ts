import { Command } from "commander";
import chalk from "chalk";
import { generateDocs } from "../core/docs.js";
import { buildSite } from "../core/site.js";
import { loadConfig } from "../utils/config.js";
import { findProjectRoot } from "../utils/paths.js";

export const docsCommand = new Command("docs")
  .description(
    "Generate a project overview and, when configured, build the spec site"
  )
  .option("-o, --output <path>", "Output file path (default: .grimoire/docs/OVERVIEW.md)")
  .action(async (options) => {
    const overview = await generateDocs({
      output: options.output,
    });
    const root = await findProjectRoot();
    const config = await loadConfig(root);
    const { skipped } = await buildSite(root, config, overview);
    console.log(
      skipped
        ? chalk.dim("spec site: not configured, skipped")
        : chalk.green("Built") + " spec site at .grimoire/site/"
    );
  });
