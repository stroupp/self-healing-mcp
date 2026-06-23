# Copilot Customizations For ATR

This repository includes lightweight GitHub Copilot customization files for enterprise UI test automation.

## File Layout

```text
.github/copilot-instructions.md
.github/instructions/*.instructions.md
.github/prompts/*.prompt.md
.github/agents/*.agent.md
```

## Token Strategy

- Keep `.github/copilot-instructions.md` short because it is always-on.
- Keep detailed task rules in scoped `.instructions.md` files.
- Use `.prompt.md` files as slash-command workflows for specific tasks.
- Use `.agent.md` files when you want a persistent role such as planner, generator, or healer.
- Do not paste all of `docs/knowledge.md` into chat; use it as a reference or through ATR MCP tools.

## Suggested Usage

Use these prompt files in Copilot Chat:

```text
/atr-analyze-project
/atr-audit-test-ids
/atr-generate-smoke-test
/atr-heal-locator
/atr-run-feature
```

Example natural-language usage:

```text
/atr-analyze-project Check this repo before we generate tests.
/atr-audit-test-ids Audit the selected React page for missing test IDs.
/atr-generate-smoke-test Generate Page Object, Steps, and feature for this page.
/atr-run-feature Run this feature and heal locator failures if needed.
/atr-heal-locator Heal the failing locator using target/failed-page.html.
```

## Smoke Test Generation Split

Smoke-test drafting is Copilot-owned because business intent usually comes from the developer, selected files, and existing project style.

Selector stabilization comes first:

```text
ATR analyzes project
  -> ATR audits test IDs
  -> Copilot reviews the audit report
  -> Copilot adds/fixes missing or duplicate data-test-id values
  -> ATR audits again until clean
```

Only then should Copilot draft smoke-test files:

```text
Copilot drafts Page/Steps/Feature
  -> ATR runs the feature
  -> ATR heals locator failures if needed
  -> ATR writes the report
```

If the business flow is unclear, Copilot should ask for:

```text
page goal
menu/navigation text
required test data
expected success condition
```

Do not paste the full UI source tree into Qwen or another non-agentic model.

Use these agents when available in your IDE:

```text
atr-planner
atr-test-generator
atr-healer
```

## MCP Tools

When the ATR MCP server is configured, Copilot should prefer:

```text
atr_knowledge_summary
atr_analyze_project
atr_self_heal_scenario
```

`atr_self_heal_scenario` is always available and should remain the main automatic healing path.

Optional generation-prep tools require:

```powershell
$env:ATR_MCP_ENABLE_OPTIONAL_TOOLS = "true"
npm run mcp
```

Optional tools:

```text
atr_audit_test_ids
atr_validate_test_artifacts
```

## Safety

- Automatic healing may edit only `src/test/**`.
- UI source changes require explicit approval.
- Shared infrastructure files are protected by default.
