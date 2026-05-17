Feature: Adversarial user persona for design review
  As a reviewer of a UI/UX change
  I want personas that simulate users hostile to the happy path
  So that designs are stress-tested before they ship

  Background:
    Given a change with design artifacts (Figma URL or HTML preview) is being reviewed
    And the conditional persona selection has engaged adversarial personas appropriate to the project surface

  Scenario: Screen-reader persona on web design
    Given `project.surface: web`
    When the screen-reader persona evaluates the design
    Then it checks for missing alt text, ARIA labels, focus order, landmark roles
    And it flags interactive elements that aren't keyboard-reachable
    And findings cite WCAG 2.2 AA criteria

  Scenario: Keyboard-only persona
    When the keyboard-navigation persona evaluates the design
    Then it checks every interactive element is tab-reachable in logical order
    And confirms focus indicators are visible (3:1 contrast minimum per WCAG 2.2)
    And flags keyboard traps and missing skip-links

  Scenario: Low-vision / color-blind persona
    When the color-contrast persona evaluates the design
    Then it checks text contrast meets 4.5:1 (normal) and 3:1 (large)
    And checks UI component contrast meets 3:1
    And flags color-only signaling (e.g., red error w/o icon or label)

  Scenario: Low-bandwidth persona
    When the low-bandwidth persona evaluates the design
    Then it flags unoptimized images, heavy JS bundles, blocking fonts
    And checks for graceful degradation / progressive enhancement
    And suggests skeleton states matching the loading scenarios

  Scenario: RTL / i18n persona (conditional)
    Given the project supports right-to-left languages or multi-locale content
    When the RTL persona evaluates the design
    Then it flags layout assumptions that break in RTL (icon mirroring, text alignment)
    And checks for hardcoded strings instead of i18n keys

  Scenario: Hostile actor persona
    When the hostile-actor persona evaluates the design
    Then it looks for input fields without explicit length / format constraints
    And flags UX that could be weaponized (e.g., unverified user-generated content rendered as HTML)
    And cross-references against `security-compliance.md` for known anti-patterns

  Scenario: Materiality gate applies
    When an adversarial persona produces findings
    Then each finding must anchor to a briefing axis (data sensitivity, threat surface, ADR, feature gap)
    And findings with no anchor are dropped per materiality gate
    And severity calibration follows the existing 3-test rule (harm path + briefing + not mitigated)

  Scenario: Steel-man before flagging
    When an adversarial persona considers a finding
    Then it first writes the steel-man (why the design likely chose this approach)
    And only files the finding if the steel-man fails
    And the finding output includes the steel-man for the user to see
