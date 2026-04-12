# Build vs Buy Research

Research methodology for evaluating existing solutions before designing custom code. Used by draft (conduct research), plan (validate decision), review (check prior art).

## When to Research

- **Level 1 (Trivial)**: Skip entirely
- **Level 2 (Simple)**: Check built-ins and first-party ecosystem only
- **Level 3-4 (Moderate/Complex)**: Full research across all categories

## Research Categories

Search for existing solutions across these categories (skip categories that clearly don't apply):

- **Language/framework built-ins**: Does the framework already have this? (e.g., Django has auth, React has context, Express has middleware). Check official docs.
- **First-party ecosystem**: Official plugins, extensions, or companion packages from the framework maintainers.
- **Popular libraries**: Search the relevant package registry (npm, PyPI, crates.io, etc.) for well-maintained packages. Use web search to find comparison articles, "best of" lists, and Stack Overflow recommendations.
- **Open-source projects**: GitHub repos that solve the same problem as a standalone tool or reference implementation.
- **SaaS/managed services**: Hosted solutions that handle the problem as a service (e.g., Auth0 for auth, Stripe for payments, Algolia for search).

For each candidate found, gather:
- **Name and link** to docs/repo
- **Maintenance signals**: last release date, commit frequency, open issues, download count
- **Fit**: does it match the project's language, framework, and deployment constraints?
- **Scope match**: does it solve 100% of the need, 80%, or just a part?
- **Trade-offs**: what design decisions does it impose? What would the project give up by adopting it?

## Decision Framework

| Signal | Points toward **adopt** | Points toward **build** |
|--------|------------------------|------------------------|
| Scope match | Solves ≥80% of the need | Solves <50% or forces unwanted constraints |
| Maintenance | Active, >1 maintainer, regular releases | Abandoned, single maintainer, or unmaintained fork |
| Integration cost | Drop-in or <1 day to integrate | Requires significant adapter code or workarounds |
| Customization | Configurable or extensible where needed | Core behavior can't be changed without forking |
| Dependencies | Few, well-known transitive deps | Heavy dependency tree or conflicts with project deps |
| Security | Audited, follows best practices, no known CVEs | Unaudited, handles sensitive data unsafely |
| Licensing | Compatible with project license | Incompatible or ambiguous license |
| Project constraints | Fits deployment target, bundle size, performance needs | Doesn't fit runtime environment or adds unacceptable overhead |

When the decision is close, **prefer adopting** — maintaining custom code is almost always more expensive than people expect.

## If Building: Learn from What Exists

When the decision is to build custom code, **study existing implementations before designing**:

- **Document the prior art**: For each relevant existing tool, note its architecture, data flows, API design, and key abstractions. What patterns does it use? What did its maintainers learn over time (check changelogs, migration guides, design docs)?
- **Identify what's different**: Be precise about why the project's needs diverge. "We need something different" is not enough — state the specific requirements that existing tools don't meet.
- **Borrow deliberately**: List specific design patterns, data flow approaches, API shapes, or architectural decisions from existing tools that should inform the custom implementation. This prevents reinventing what others have already refined.
- **Scope the custom work**: Define the minimum viable version. If an existing tool does 10 things and you only need 3, build those 3. Don't replicate the full feature set.

## Present Findings Format

Present a structured summary **before drafting any artifacts**:

```markdown
## Prior Art Research

### Existing Solutions Found
1. **[name]** — [one-line description]. [fit assessment]. [key trade-off].
2. **[name]** — ...

### Recommendation
- **Adopt [name]** because [reasons] → draft becomes an ADR documenting the adoption
- OR **Build custom** because [specific gaps: requirement X isn't met by any option, constraint Y rules out adoption]. Borrowing [patterns/flows] from [existing tool].
- OR **Hybrid**: adopt [name] for [scope] and build custom [scope] because [reasons]

### If Building: What Makes This Different
- [Requirement that no existing tool meets]
- [Constraint that rules out adoption]
- [Design decision that must differ from prior art, and why]

### If Building: Borrowed from Prior Art
- [Pattern/flow/API shape] from [tool] — because [reason it's proven]
```

Wait for user agreement on the direction before proceeding.
