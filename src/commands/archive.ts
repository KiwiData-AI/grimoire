import { Command } from "commander";
import { archiveChange, ArchiveError } from "../core/archive.js";
import chalk from "chalk";

export const archiveCommand = new Command("archive")
  .description("Archive a completed change")
  .argument("<change-id>", "Change to archive")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (changeId: string, options) => {
    try {
      await archiveChange(changeId, {
        yes: options.yes ?? false,
      });
    } catch (err) {
      if (err instanceof ArchiveError) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
      throw err;
    }
  });
