---
status: draft
change-id: add-mkdocs-spec-site
kind: greenfield
---

# add-mkdocs-spec-site — draft

**Date:** 2026-08-21 · **Provenance:** conversation 2026-08-21 (tool comparison, Grimoire Look Book artifact — Midnight Kiwi selected, dark-only)

## At a glance

```
consumer repo (e.g. bake)
  features/**/*.feature ──────────┐
  .grimoire/decisions/*.md ───────┤   grimoire docs
  .grimoire/docs/constraints.md ──┘   (generate/refresh)
                 │
                 ▼
  <generated site source>            ← regenerated each run
    mkdocs.yml                       nav: Features / Decisions / Constraints
    docs/**/*.md                     features wrapped in ```gherkin fences,
                                     ADRs with status badges, constraints register
    extra.css                        Midnight Kiwi tokens (--md-* overrides)
                 │
                 ▼
  mkdocs serve / build (Material theme)
                 │
                 ▼
  dark, searchable spec site — built-in client-side search
```

## Why

Consumers of grimoire (bake, shake, FastAPI services) accumulate specs as flat files:
`features/`, `.grimoire/decisions/`, `constraints.md`. Reviewing them means reading raw
markdown in an editor. The objective: `grimoire` generates a browsable, searchable,
grimoire-branded web UI over those artifacts in any consumer repo. Solved when a consumer
runs one grimoire command and gets a served MkDocs Material site showing features (rendered
Gherkin), decisions (with status), and constraints.

Non-goals:
- This repo's own documentation — stays VitePress (`docs/`, `doc_tool: vitepress`).
- Editing specs through the UI — read-only viewer; git remains the write path.
- Test-result injection (mkdocs-gherkin-plugin style living docs) — out of scope for v1.

## Decisions

| #  | Decision (Y-statement: context · option over alternatives · accepting downside) | Why (because…) |
|----|----------|-----|
| D1 | In the context of a spec-viewer UI for consumer repos, facing the need for search + theming + Gherkin rendering with minimal build, chose MkDocs Material over VitePress, log4brains, Pickles, and Augurk, accepting a Python toolchain in possibly-JS repos. | Material has built-in client-side search, deep theming via CSS tokens, and Pygments highlights Gherkin natively; log4brains covers only ADRs and is lightly maintained; Pickles/Augurk are .NET-centric and stale. |
| D2 | In the context of branding the generated site, facing grimoire-identity vs consumer-brand, chose a dark-only "Midnight Kiwi" theme derived from the grimoire logo over a light/dark toggle pair, accepting no light mode. | User selected Midnight Kiwi from three logo-derived looks and chose dark-only. Palette: ground `#141a24`, header `#0e131b`, primary `#a8c94e`, accent `#6fd3f2`, text `#d9dfe6`, surface `#1e2530`. |
| D3 | In the context of where the site lives, chose generation into consumer repos over hosting anything in the grimoire repo, accepting per-repo regeneration. | Each consumer's specs are its own; grimoire ships the generator + theme, not a site. |
| D4 | In the context of keeping docs current, facing stale-site risk, chose regenerating + statically building the site as part of the finalize step over an always-manual command, accepting finalize doing more work. | When a change is finalized the specs changed; regenerating there guarantees the site matches what merged. |
| D5 | In the context of the Python toolchain in possibly-JS repos, chose a user-configured build command in `config.yaml` over grimoire managing the MkDocs install, accepting that docs generation is skipped when unconfigured. | Config over hardcode; the site is an optional feature — the user supplies how docs get regenerated (e.g. `uvx --with mkdocs-material mkdocs build`, or plain `mkdocs build`), grimoire just runs it. |
| D6 | In the context of rendering `.feature` files, chose pre-generating markdown pages at regen time over a build-time mkdocs plugin, accepting pages exist only after a regen. | No Python plugin dependency; regen already runs at finalize so pages are always rebuilt from the live specs. |
| D7 | In the context of site placement, chose `.grimoire/site/` in the consumer repo for generated sources over a top-level dir, accepting a nested path. | Keeps grimoire-owned generated material under `.grimoire/`, per user. |
| D8 | In the context of on-demand regeneration, facing a name clash with the existing `grimoire docs` (OVERVIEW.md generator), chose extending `grimoire docs` — overview always, site additionally when configured — over a new `grimoire site` command, accepting the command doing two things. | One entry point for "regenerate project docs", per user; the finalize hook runs the same command (D4). |
| D9 | In the context of the site's landing page, chose reusing the OVERVIEW.md output as the site index over a separate index renderer, accepting the index carrying the overview's single-file layout. | One rendering path (DRY); `grimoire docs` already produces it in the same run. Inferred — flag in review if wrong. |

## Decided / Open

**Decided:**
- MkDocs Material is the site generator (D1).
- Dark-only Midnight Kiwi branding, palette fixed from logo.png (D2).
- Site is generated per consumer repo; grimoire ships generator + theme templates (D3).
- Content minimum: features (Gherkin-rendered), decisions (with status), constraints.
- Regen + static build runs at the finalize step; optional — active only when configured (D4, D5).
- Build command is user-configured in `config.yaml`; grimoire runs it, never manages the MkDocs install (D5).
- Markdown pages are pre-generated at regen time; no mkdocs plugin (D6).
- Generated sources live at `.grimoire/site/` in the consumer repo (D7).

**Open:**
- ~~Q1 (invocation)~~ RESOLVED: regen runs as part of finalize (D4).
- ~~Q2 (Python toolchain)~~ RESOLVED: user-configured build command in config; feature is optional, skipped when unconfigured (D5).
- ~~Q3 (feature rendering)~~ RESOLVED: pre-generate markdown at regen time (D6).
- ~~Q5 (repo placement)~~ RESOLVED: `.grimoire/site/` (D7).
- ~~Q6 (brand override)~~ RESOLVED: YAGNI — always Midnight Kiwi, no consumer-brand override, per user.
- ~~Q4 (content scope)~~ RESOLVED: grimoire items only — features, decisions, constraints. Area docs, OVERVIEW, and data schema stay out (→ Cut).
- ~~Q7 (built output)~~ RESOLVED: build is static HTML, living in `.grimoire/site/` — committed so the site is current after finalize (D7).
- ~~Q8 (manual regen)~~ RESOLVED: add a `grimoire docs` command for on-demand regen (D8).

## Cut / deferred

| Cut | What it was | Why cut | Re-add when |
|-----|-------------|---------|-------------|
| Test-result injection | mkdocs-gherkin-plugin wiring cucumber reports into pages | v1 is a spec viewer, not living-docs | Consumers ask for pass/fail state on scenarios |
| Light theme | Orchard/Spellbook light halves + toggle | User chose dark-only | User wants a light mode |
| Non-spec content | Area docs (`.grimoire/docs/*.md`), `OVERVIEW.md`, data schema in the nav | Grimoire spec items only, per user | User wants the site to cover project docs too |
| Brand override | Consumer `.grimoire/brand/tokens.json` re-theming the site | YAGNI, per user | A consumer actually asks for their own palette |
