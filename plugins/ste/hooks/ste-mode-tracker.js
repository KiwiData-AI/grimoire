#!/usr/bin/env node
// ste — UserPromptSubmit hook to track which ste mode is active
// Inspects user input for /ste commands and writes mode to the flag file,
// then emits a per-turn reminder while a mode is active.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDefaultMode, safeWriteFlag, readFlag, VALID_MODES } = require('./ste-config');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.ste-active');

const REMINDERS = {
  ste: 'STE MODE ACTIVE (ste). Complete sentences, keep articles, one fact per sentence. ' +
    'No filler, no hedging, no rhetorical scaffolding ("honestly", "load-bearing", ' +
    '"it\'s not X, it\'s Y"), no invented labels. Code/commits/security: write normal.',
  caveman: 'STE MODE ACTIVE (caveman). Drop articles/filler/pleasantries/hedging. ' +
    'Fragments OK. Code/commits/security: write normal.',
};

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').trim().toLowerCase();

    // Natural language activation ("ste mode", "activate ste", "turn on ste").
    if (/\b(activate|enable|turn on|start)\b.*\bste\b/i.test(prompt) ||
        /\bste\b.*\b(mode|activate|enable|turn on|start)\b/i.test(prompt)) {
      if (!/\b(stop|disable|turn off|deactivate)\b/i.test(prompt)) {
        const mode = getDefaultMode();
        if (mode !== 'off') safeWriteFlag(flagPath, mode);
      }
    }

    // /ste [level] commands
    if (prompt.startsWith('/ste')) {
      const parts = prompt.split(/\s+/);
      const cmd = parts[0];
      const arg = parts[1] || '';

      if (cmd === '/ste' || cmd === '/ste:ste') {
        let mode;
        if (VALID_MODES.includes(arg)) mode = arg;
        else mode = getDefaultMode();

        if (mode === 'off') {
          try { fs.unlinkSync(flagPath); } catch (e) {}
        } else {
          safeWriteFlag(flagPath, mode);
        }
      }
    }

    // Deactivation — natural language
    if (/\b(stop|disable|deactivate|turn off)\b.*\bste\b/i.test(prompt) ||
        /\bste\b.*\b(stop|disable|deactivate|turn off)\b/i.test(prompt) ||
        /\bnormal mode\b/i.test(prompt)) {
      try { fs.unlinkSync(flagPath); } catch (e) {}
    }

    // Per-turn reinforcement: the SessionStart hook injects the full ruleset
    // once, but models lose it when other context competes every turn.
    // readFlag enforces symlink-safe read + size cap + VALID_MODES whitelist —
    // never inject untrusted bytes into model context.
    const activeMode = readFlag(flagPath);
    if (activeMode && REMINDERS[activeMode]) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: REMINDERS[activeMode],
        }
      }));
    }
  } catch (e) {
    // Silent fail
  }
});
