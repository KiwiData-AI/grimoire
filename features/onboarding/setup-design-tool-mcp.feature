Feature: Set up design-tool MCP integration at onboarding
  As a project owner running grimoire init
  I want grimoire to configure the design-tool MCP server when I pick a tool
  So that AI agents can read designs directly without manual config wiring

  Background:
    Given I am running `grimoire init` interactively
    And the onboarding flow reaches the "Front-end design" section

  Scenario: User picks Figma and accepts MCP setup
    When I answer "figma" to "Design tool? (figma/sketch/penpot/framer/none)"
    Then I am asked "Install Figma Dev Mode MCP server? (Y/n)"
    And on "y" the Figma MCP server config is added to `.grimoire/config.yaml` under `project.design_tool.mcp`
    And I am told to install the Figma desktop app and enable Dev Mode if not already done
    And install instructions are printed at the end of onboarding (same pattern as codebase-memory-mcp)

  Scenario: User picks Sketch (no first-class MCP)
    When I answer "sketch"
    Then grimoire records the design tool name in config
    And generates `.grimoire/docs/design-tool-setup.md` w/ generic MCP stub instructions
    And tells me "Sketch lacks a first-class MCP. See docs/design-tool-setup.md for manual setup steps."

  Scenario: User declines design tool
    When I answer "none" or press Enter
    Then no `design_tool` entry is added to config
    And no MCP server config is added
    And onboarding proceeds without prompting for URL or asset paths

  Scenario: User provides Figma URL during onboarding
    Given I picked "figma" as my design tool
    When I am asked "Design project URL?"
    And I provide a Figma file URL
    Then it is stored in `.grimoire/config.yaml` under `project.design_tool.url`
    And `grimoire-design` uses it as the default design source for new changes

  @security
  Scenario: MCP setup does not store secrets in config
    When the Figma MCP is configured
    Then the config references the MCP server via command/url only
    And no Figma personal-access tokens are written to `.grimoire/config.yaml`
    And the user is reminded to set `FIGMA_ACCESS_TOKEN` in their shell environment
