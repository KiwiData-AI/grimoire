Feature: Initiate a design session with problem statement gate
  As a designer
  I want grimoire-design to refuse generic design work until I articulate a problem
  So that downstream designs and Gherkin scenarios stay grounded in user value

  Background:
    Given I have run `grimoire init` and grimoire is set up
    And I invoke `grimoire-design` (or say "let's design X")

  Scenario: User provides problem statement up-front
    When I describe the change w/ a clear user problem (e.g., "users can't recover locked accounts")
    Then grimoire-design records the problem statement at `.grimoire/changes/<id>/designs/problem.md`
    And proceeds to elicit user flow, success metrics, and design variants

  Scenario: User skips problem statement — soft gate fires
    When I describe the change with no user-problem context (e.g., "make a settings page")
    Then grimoire-design warns me with a semi-aggressive message:
      """
      No user problem articulated. Generic designs ≈ wasted iteration.
      The most common cause of redesigns is missing problem context.
      Strongly recommend stating the problem first.
      """
    And asks "Proceed without problem statement? (y/N)"
    And if I confirm "y", logs `problem_statement: skipped (user override)` in problem.md and proceeds

  Scenario: User picks problem-statement framework from menu
    When the problem-statement prompt runs
    Then I am shown a menu:
      | option | format |
      | jtbd | When [situation], I want to [motivation], so I can [outcome] |
      | lean-ux | Business problem / users / outcomes / solutions / hypotheses |
      | hmw | How might we [verb] [user] [outcome]? |
      | pr-faq | Press release + FAQ working-backwards |
      | freeform | (user writes their own) |
    And the chosen template is rendered for me to fill in

  Scenario: User flow captured at minimum-viable level
    When the user-flow prompt runs
    Then grimoire-design asks for a friction-log style narrative as default (minimum viable)
    And offers to upgrade to a Mermaid journey diagram if I'm comfortable
    And offers to upgrade further to a service blueprint if I'm comfortable
    And accepts whatever level I provide without forcing the upgrade

  Scenario: User pain points explicitly elicited
    When the user-flow prompt runs
    Then grimoire-design separately asks "What are the user's current pain points?"
    And the prompt is distinct from the flow-narrative prompt (not bundled together)
    And accepts a bulleted list, free text, or "none known" as valid answers
    And captures pain points in `problem.md` under a dedicated "Pain Points" section
    And references captured pain points when generating variants (each variant must state which pain points it addresses or explicitly mark "deferred")

  Scenario: Pain points feed adversarial persona engagement
    Given pain points include accessibility-related items (e.g., "screen reader users can't tab through")
    When grimoire-review later runs on the design
    Then the adversarial persona engagement matrix prioritizes personas matching the captured pain points
    And findings citing those pain points reference `problem.md` as the briefing anchor

  Scenario: Success metrics captured
    When the success-metrics prompt runs
    Then I am asked for at least one measurable outcome (e.g., "reduce support tickets about lockouts by 50%")
    And if I cannot articulate one, grimoire-design notes "no success metric — design effectiveness will be hard to evaluate" as an assumption
