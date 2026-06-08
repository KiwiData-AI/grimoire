# Getting started

Grimoire is a spec-driven development framework for AI coding assistants. It
encodes requirements, design review, TDD, and traceability into workflows your
AI agents can't skip.

## Requirements

- Node.js 20+
- git

## Install

```bash
npm install -g @kiwidata/grimoire
```

Verify:

```bash
grimoire --version
```

## Initialize a project

From your project root:

```bash
grimoire init
```

This generates `AGENTS.md` instructions and installs skills for the AI agents
you select. See [`grimoire init`](/reference/cli#grimoire-init) for the full
flag list.

## Day-to-day commands

| Command | What it does |
| --- | --- |
| [`grimoire status`](/reference/cli#grimoire-status) | Show a change's artifacts and tasks |
| [`grimoire validate`](/reference/cli#grimoire-validate) | Validate specs and artifacts |
| [`grimoire check`](/reference/cli#grimoire-check) | Check a change against its spec |
| [`grimoire trace`](/reference/cli#grimoire-trace) | Trace commits back to requirements |
| [`grimoire update`](/reference/cli#grimoire-update) | Refresh `AGENTS.md` + skills to latest |

The full command set with every flag lives in the [CLI reference](/reference/cli),
which is generated from the CLI itself and stays in sync with each release.
