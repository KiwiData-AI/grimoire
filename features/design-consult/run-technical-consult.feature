Feature: Run technical consult before full design
  As a designer
  I want to ask security and data experts about my proposed change before doing full design work
  So that I avoid investing in a design that engineering will block on technical grounds

  Background:
    Given grimoire is set up in the project
    And I invoke `grimoire-design-consult` (or say "tech check this idea")

  Scenario: Minimal input requested
    When the consult skill starts
    Then I am asked only for:
      | input | required |
      | problem statement | yes |
      | proposed user flow (1-2 sentences) | optional |
      | data the design will touch (free text) | optional |
    And no artifacts (manifest, features, decisions) are required to exist

  Scenario: Security and data personas activated by default
    When the consult runs
    Then the Security Engineer persona engages in Q&A mode
    And the Data Engineer persona engages in Q&A mode
    And other personas are available on request but not run by default

  Scenario: Personas ask, designer answers
    When the Security persona engages
    Then it asks questions like "What user data flows through this screen?" and "Is any of it PII or financial?"
    And it does NOT produce blocker/suggestion findings (that's review's job)
    And the Q&A is conversational, not a checklist dump

  Scenario: Output captured as Q&A transcript
    When the consult completes
    Then grimoire-design-consult writes `.grimoire/changes/<id>/consult.md` containing:
      | section | content |
      | Problem statement | as provided by user |
      | Security Q&A | transcript of questions + designer's answers |
      | Data Q&A | transcript of questions + designer's answers |
      | Inferred assumptions | bulleted list distilled from Q&A |
      | Inferred givens | bulleted list distilled from Q&A |
      | Open questions | unanswered items flagged for follow-up |

  Scenario: Handoff to grimoire-design
    Given a `consult.md` exists for a change
    When I run `grimoire-design` on the same change-id
    Then grimoire-design reads `consult.md` first
    And copies the "Inferred assumptions" and "Inferred givens" into `manifest.md`
    And references them when generating designs (e.g., w/ PII, propose patterns that minimize exposure)

  Scenario: Engineer use case
    Given I am an engineer (not a designer)
    When I want to think through a feature before drafting
    Then `grimoire-design-consult` works identically for me
    And the resulting consult.md flows into `grimoire-draft` the same way

  Scenario: User can add other personas
    When I invoke `grimoire-design-consult --personas=security,data,qa`
    Then QA Engineer persona is added to the Q&A
    And asks testability questions in addition to security and data

  Scenario: Skip the consult — soft suggestion only
    Given the user has not run consult before a high-risk-tagged change
    When `grimoire-design` or `grimoire-draft` starts
    Then a soft suggestion appears: "Consider `grimoire-design-consult` first — this change touches PII/payments"
    And the suggestion does not block the workflow
