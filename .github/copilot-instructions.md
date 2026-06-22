# ATR Repository Instructions

Use these rules for enterprise UI test automation projects that use React, Cucumber, Selenide, Java Page Objects, and `data-test-id` selectors.

## Core Rules

- Prefer stable `data-test-id` selectors over CSS hierarchy selectors.
- Never use real customer data, account numbers, credentials, tokens, production secrets, or private business identifiers.
- Do not change production UI behavior when adding test identifiers.
- Do not regenerate shared test infrastructure unless explicitly requested.
- Keep generated tests short, deterministic, and focused on critical smoke coverage.
- Before writing new locators, inspect existing Page Objects, feature files, step definitions, and project conventions.
- When self-healing, prefer ATR MCP/CLI tools over guessing from chat alone.
- Stabilize `data-test-id` coverage before smoke-test generation.
- For smoke-test generation, Copilot drafts the files after selector audit is clean; ATR analyzes, audits, runs, heals, and reports.

## ATR MCP Tools

Use these tools when available:

- `atr_knowledge_summary`: read normalized project rules from `docs/knowledge.md`.
- `atr_analyze_project`: inspect project structure before generation or healing.
- `atr_self_heal_scenario`: run, heal, rerun, and report a failing Cucumber/Selenide scenario.
- Optional `atr_audit_test_ids`: report missing or duplicate `data-test-id` values when optional ATR tools are enabled.

## Safety Boundary

- Automatic locator healing may edit only `src/test/**`.
- UI source changes such as adding `data-test-id` attributes require explicit user approval.
- Shared infrastructure files are protected by default.

## Knowledge Usage

- Treat `docs/knowledge.md` as the full reference.
- Do not paste the whole knowledge file into chat.
- Load only the relevant prompt/instruction file for the current task.

## Prompt Routing Examples

- For project inspection, use `/atr-analyze-project`.
- For missing test IDs, use `/atr-audit-test-ids`.
- For smoke test generation, use `/atr-generate-smoke-test`.
- For locator healing, use `/atr-heal-locator`.
- For running a feature with healing fallback, use `/atr-run-feature`.
