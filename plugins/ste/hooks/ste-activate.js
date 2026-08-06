#!/usr/bin/env node
// ste — Claude Code SessionStart activation hook
//
// Runs on every session start:
//   1. Writes flag file at $CLAUDE_CONFIG_DIR/.ste-active (statusline reads this)
//   2. Emits the ste ruleset as hidden SessionStart context

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDefaultMode, safeWriteFlag } = require('./ste-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.ste-active');

const mode = getDefaultMode();

if (mode === 'off') {
  try { fs.unlinkSync(flagPath); } catch (e) {}
  process.stdout.write('OK');
  process.exit(0);
}

safeWriteFlag(flagPath, mode);

// Emit the full ruleset, filtered to the active level. A short summary is too
// weak — models drift back to verbose mid-conversation, especially after
// context compression prunes it away.
//
// Reads SKILL.md at runtime so edits to the source of truth propagate
// automatically — no hardcoded duplication to go stale.
let skillContent = '';
try {
  skillContent = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'ste', 'SKILL.md'), 'utf8'
  );
} catch (e) {
  // SKILL.md missing — emit a minimal ruleset rather than nothing.
}

let output;

if (skillContent) {
  const body = skillContent.replace(/^---[\s\S]*?---\s*/, '');

  // Keep only the active level's intensity-table row and example lines.
  const filtered = body.split('\n').reduce((acc, line) => {
    const tableRowMatch = line.match(/^\|\s*\*\*(\S+?)\*\*\s*\|/);
    if (tableRowMatch) {
      if (tableRowMatch[1] === mode) acc.push(line);
      return acc;
    }
    const exampleMatch = line.match(/^- (\S+?):\s/);
    if (exampleMatch) {
      if (exampleMatch[1] === mode) acc.push(line);
      return acc;
    }
    acc.push(line);
    return acc;
  }, []);

  output = 'STE MODE ACTIVE — level: ' + mode + '\n\n' + filtered.join('\n');
} else {
  output =
    'STE MODE ACTIVE — level: ' + mode + '\n\n' +
    'Write like a technical manual: terse, complete, unambiguous.\n' +
    'Delete: pleasantries, hedging, filler, restated questions, rhetorical scaffolding\n' +
    '("honestly", "load-bearing", "it\'s not X, it\'s Y", "the key insight").\n' +
    'Construct: keep articles, complete sentences, max ~20 words per sentence, one fact\n' +
    'per sentence, same full name for each thing every time, no invented labels.\n' +
    'Code blocks unchanged. Errors quoted exact. Code/commits/PRs: write normal.';
}

process.stdout.write(output);
