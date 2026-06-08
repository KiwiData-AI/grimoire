export default {
  import: ["features/steps/**/*.ts"],
  paths: ["features/**/*.feature"],
  // @manual scenarios describe AI-agent behaviour that is not deterministically
  // testable without an LLM in the loop — they are living documentation, not run here.
  tags: "not @manual",
};
