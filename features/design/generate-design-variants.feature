Feature: Generate design variants
  As a designer using grimoire-design
  I want to see multiple distinct design approaches for the same problem
  So that I evaluate alternatives instead of committing to the first idea

  Background:
    Given I have completed the problem statement and user flow for a change
    And `grimoire-design` is ready to generate variants

  Scenario: Default 3 variants generated
    When variant generation runs
    Then grimoire-design produces 3 distinct design variants by default
    And each variant references brand tokens from `.grimoire/brand/tokens.json` (if present)
    And each variant explicitly states what tradeoff it optimizes for (e.g., "minimal clicks", "maximum information density", "progressive disclosure")

  Scenario: User overrides variant count
    When I invoke `grimoire-design --variants=5`
    Then grimoire-design produces 5 variants
    And accepts any positive integer up to 10

  Scenario: Output to Figma when design tool is configured
    Given `.grimoire/config.yaml` has `project.design_tool.name: figma` AND a `mcp` block
    When variants are generated
    Then grimoire-design writes designs to Figma via MCP (if MCP supports write) or generates Figma-importable JSON
    And variants are referenced from `.grimoire/changes/<id>/designs/variants.md` by Figma node ID

  Scenario: Default to HTML when no design tool
    Given no `design_tool` is configured
    And the change is non-trivial (more than a copy change or single form field)
    When variants are generated
    Then grimoire-design writes each variant as a static HTML file at `.grimoire/changes/<id>/designs/variant-{n}.html`
    And HTML uses brand tokens via CSS custom properties (if `.grimoire/brand/tokens.json` exists)
    And HTML is self-contained (no external CDN dependencies) and openable directly in a browser

  Scenario: ASCII for trivial changes
    Given the change is trivial (copy change, single-field form, button label)
    When variants are generated
    Then grimoire-design produces ASCII wireframes inline in `variants.md`
    And does not generate HTML files (overkill for the scope)

  Scenario: Component-library inventory triggered lazily
    Given this is the first time `grimoire-design` runs on this project
    And `.grimoire/docs/components.md` does not exist
    When variant generation begins
    Then grimoire-design first scans for an existing component library (shadcn, MUI, Chakra, custom)
    And produces `.grimoire/docs/components.md` listing reusable components w/ paths
    And subsequent variants prefer existing components over net-new designs

  Scenario: User requests revision
    When I say "redo variant 2 with a wizard pattern instead"
    Then grimoire-design regenerates variant 2 only
    And leaves variants 1 and 3 unchanged
