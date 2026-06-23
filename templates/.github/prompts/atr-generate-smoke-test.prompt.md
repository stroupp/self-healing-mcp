---
name: atr-generate-smoke-test
description: Generate Cucumber/Selenide smoke test artifacts for one page or flow.
agent: agent
---

Generate a smoke test draft for the requested page or flow.

This task is Copilot-owned. ATR should be used as a support tool for project analysis, test-id audit, running tests, and locator healing, not as the main smoke-test author.

Produce only these artifacts unless I ask for more:
1. `{PageName}Page.java`
2. `{PageName}Steps.java`
3. `{page-name}.feature`

Rules:
- Use `atr_analyze_project` first when ATR MCP is available.
- Before generating tests, confirm that `data-test-id` audit is clean for the page and its child components.
- Use `atr_audit_test_ids` if optional ATR MCP tools are enabled and test-id coverage is not already confirmed.
- Use `atr_validate_test_artifacts` if optional ATR MCP tools are enabled.
- If missing or duplicate IDs are found, stop test generation and help the user fix those first.
- Read the selected page and its locally imported child components.
- If the business flow is unclear, ask for page goal, navigation/menu text, required test data, and success condition.
- Reuse existing shared login, navigation, hooks, and utility classes.
- Prefer `data-test-id` locators.
- Keep Gherkin short and deterministic.
- Do not write real customer data or secrets.
- Before editing, list files you intend to create or modify.
- After editing, run the narrowest relevant test command when possible.
- If a locator fails, use ATR self-healing with `atr_self_heal_scenario`.

Context boundary:
- Do not ask Qwen or another LLM to read the full UI project.
- Use local files selected by the user, imported child components, and existing test patterns.
- ATR validates and heals after Copilot drafts the files.

Example requests:

```text
/atr-generate-smoke-test Generate a smoke test for the Transfer page.
/atr-generate-smoke-test Create Page Object, Steps, and feature for this selected React page.
/atr-generate-smoke-test Use existing shared login/navigation steps and do not touch shared infrastructure.
/atr-generate-smoke-test If the flow is unclear, ask me for business intent before writing files.
/atr-generate-smoke-test First confirm the data-test-id audit is clean, then generate tests.
```
