Feature: Detect project surface to wire appropriate review personas
  As a project owner running grimoire init
  I want grimoire to detect whether my project is TUI / web / mobile / API
  So that the right review personas auto-wire without manual config

  Background:
    Given I am running `grimoire init` on an existing repository

  Scenario Outline: Web project detected from framework signals
    Given the repo contains <signal>
    When tool detection runs
    Then `project.surface: web` is written to `.grimoire/config.yaml`
    And I am told which signal triggered the detection

    Examples:
      | signal |
      | `package.json` with React, Vue, Svelte, Angular, or Next dependencies |
      | an `index.html` referenced by a build tool |

  Scenario Outline: Mobile project detected from framework signals
    Given the repo contains <signal>
    When tool detection runs
    Then `project.surface: mobile` is written to `.grimoire/config.yaml`

    Examples:
      | signal |
      | `ios/` AND `android/` directories (React Native) |
      | a `pubspec.yaml` (Flutter) |
      | a `.xcodeproj` or `build.gradle` with mobile signals |

  Scenario Outline: TUI project detected from framework signals
    Given the repo contains <signal>
    When tool detection runs
    Then `project.surface: tui` is written to `.grimoire/config.yaml`

    Examples:
      | signal |
      | `package.json` with ink, blessed, or textual-ui dependencies |
      | `pyproject.toml` with textual or rich dependencies |
      | `Cargo.toml` with ratatui or tui-rs dependencies |

  Scenario: API-only project detected
    Given the repo contains FastAPI, Flask, Express, Gin, or Spring Boot signals
    And no front-end framework is detected
    When tool detection runs
    Then `project.surface: api` is written to `.grimoire/config.yaml`

  Scenario: Mixed-surface project detected
    Given multiple surface signals are detected (e.g., React + FastAPI)
    When tool detection runs
    Then `project.surface: mixed` is written to `.grimoire/config.yaml`
    And the user is informed and offered to override

  Scenario: Greenfield project — user picks surface
    Given the repo contains no recognizable framework signals
    When tool detection runs
    Then I am asked "Project surface? (tui/web/mobile/api/mixed/skip)"
    And my answer is written to `.grimoire/config.yaml`

  Scenario: Greenfield project — user skips
    Given the repo contains no recognizable framework signals
    When tool detection runs
    And I answer "skip" to the surface prompt
    Then `surface` is omitted from `.grimoire/config.yaml`

  Scenario: User override during onboarding
    Given automatic detection picks `web`
    When I am shown the detected value and asked to confirm or override
    And I type "tui"
    Then `project.surface: tui` is written (user override beats heuristic)
