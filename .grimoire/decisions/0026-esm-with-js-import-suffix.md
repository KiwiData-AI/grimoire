---
status: accepted
date: 2026-05-17
decision-makers: [Fred]
recorded-by: Claude (backfill via grimoire-audit on 2026-05-17)
---

# Use native ES modules with .js import suffixes in TypeScript source

## Context and Problem Statement
Node.js supports two module systems: CommonJS (`require`/`module.exports`) and ES modules (`import`/`export`). When using TypeScript with the ESM target, imports must reference the *output* file extension (`.js`) even though the source file is `.ts`. This is surprising for contributors who haven't worked with TypeScript+ESM before.

## Decision Drivers
- Modern Node and modern tooling assume ESM
- The dependencies grimoire uses (`chalk` ≥ 5, `commander` ≥ 12) are ESM-only
- Want to ship one published artifact, not dual CJS/ESM
- Source must compile to runnable ESM without a bundler step

## Considered Options
1. **ESM with `.js` suffix on imports** — `import { x } from "./module.js"` in `.ts` source
2. **CommonJS** — `import` statements compiled to `require` by TypeScript
3. **Dual package** — ship both CJS and ESM via tsup or unbuild
4. **Bundle to single file** — esbuild/rollup to a single artifact, skipping the suffix question

## Decision Outcome
Chosen option: **ESM with `.js` suffix in source**. Modern dependencies require it, Node's ESM resolver requires the exact extension at runtime, and TypeScript's `--module nodenext` produces correct output when we author imports this way. The suffix surprises newcomers but is the canonical TypeScript+ESM pattern in 2026.

`package.json` has `"type": "module"`, `tsconfig.json` uses `"module": "NodeNext"`, and every internal import inside `src/` references `./<name>.js`.

### Consequences
- Good: One artifact, one module system, modern tooling friendly.
- Good: We can use ESM-only dependencies without ceremony.
- Good: Tree-shaking and top-level `await` work out of the box.
- Bad: The `.js`-suffix-on-`.ts`-source pattern is one of the most-asked-about quirks of TypeScript+ESM. A new contributor will likely hit a "but the file is `.ts`!" moment.
- Bad: Test files must follow the same convention, which is yet another thing to remember.

### Cost of Ownership
- **Maintenance burden**: Light; once the pattern is internalized it's automatic.
- **Ongoing benefits**: Modern Node features available; ecosystem moves toward ESM-only.
- **Sunset criteria**: Revisit if a future TypeScript release ships extension-optional ESM imports as the recommended default, or if Node ESM resolution stops requiring the explicit `.js` extension. Treat both as "check at the time of each major TS upgrade" rather than a calendar date.

### Confirmation
Measurable signals:
- `npm run build` produces `dist/` that runs under Node 20 + 22 in `.github/workflows/release.yml` without `ERR_MODULE_NOT_FOUND`
- `grep -rn "from \"\\./[^\"]*\\.ts\"" src/` returns zero matches (no `.ts` extensions in imports)
- `grep -rn "from \"\\./[^.]*\"" src/ | grep -v "node:"` returns zero matches (no missing extensions in relative imports)
