Feature: Capture brand guidelines at onboarding
  As a project owner running grimoire init
  I want to optionally capture brand guidelines in a machine-readable format
  So that AI agents stop producing generic-looking UI and respect our brand

  Background:
    Given I am running `grimoire init` interactively
    And the onboarding flow has reached the "Front-end design" section

  Scenario: User opts in to brand capture
    When I am asked "Capture brand guidelines now? (y/N)"
    And I answer "y"
    Then I am prompted for primary, secondary, and accent colors with hex values
    And I am prompted for typography (font family, base size, scale)
    And I am prompted for spacing scale (base unit, multipliers)
    And I am prompted for logo asset paths (light, dark, mono variants)
    And I am prompted for favicon path
    And I am prompted for voice/tone with one do-example and one don't-example
    And grimoire writes `.grimoire/brand/tokens.json` in DTCG (W3C Design Tokens) format
    And grimoire writes `.grimoire/brand/voice.md` with the captured voice/tone

  Scenario: User skips brand capture
    When I am asked "Capture brand guidelines now? (y/N)"
    And I answer "n" or press Enter
    Then `.grimoire/brand/` is not created
    And onboarding proceeds to the next section
    And I am told I can run `grimoire-design --capture-brand` later to add it

  Scenario: User has existing tokens.json in repo
    Given the repo already contains a `tokens.json` file or DTCG-formatted brand file
    When the brand capture step runs
    Then grimoire detects the existing file
    And asks "Use existing tokens.json at <path>? (Y/n)"
    And copies it to `.grimoire/brand/tokens.json` if accepted

  @input-validation
  Scenario: Invalid hex color rejected
    When I enter "#ZZZ123" as the primary color
    Then I see an error "Invalid hex color"
    And I am re-prompted for the value

  Scenario: Optional fields can be skipped
    When I press Enter for "logo path" (no logo available yet)
    Then the field is omitted from tokens.json
    And brand capture continues to the next prompt
