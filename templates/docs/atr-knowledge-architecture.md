# ATR Knowledge Architecture

This document describes the generic knowledge-driven ATR structure.

## Goal

ATR should use a project knowledge file to guide test-id generation, Page Object generation, smoke-test generation, and locator healing without sending a large raw document to the model on every request.

## Flow

```text
docs/knowledge.md
  -> ATR knowledge loader
  -> normalized rules
  -> MCP tools
  -> agent request
  -> generated or healed test automation files
```

## Current MCP Tools

```text
atr_knowledge_summary
atr_analyze_project
atr_self_heal_scenario
```

`atr_knowledge_summary` loads `docs/knowledge.md` and exposes a generic structured summary.

`atr_analyze_project` scans the target project and reports detected React, Cucumber, Selenide, Page Object, locator, and `data-test-id` structure.

`atr_self_heal_scenario` runs the test, captures failure context, asks the configured model for a candidate, applies safe test-file changes, reruns, and writes a report.

## Optional MCP Tools

Optional tools are hidden unless the MCP server is started with:

```powershell
$env:ATR_MCP_ENABLE_OPTIONAL_TOOLS = "true"
npm run mcp
```

Current optional tools:

```text
atr_audit_test_ids
atr_validate_test_artifacts
```

`atr_audit_test_ids` scans React files and writes a report of missing `data-test-id` candidates. It also reports duplicate existing IDs and avoids proposing IDs that collide with existing or newly proposed IDs. It does not edit files.

`atr_validate_test_artifacts` checks audit cleanliness and optional feature-step bindings. It does not edit files.

## Next Tools

```text
atr_generate_test_ids
atr_generate_page_object
atr_generate_smoke_test
```

These should be added in that order.

## CLI Modes

```powershell
npm run atr -- --mode knowledge --workspace "C:\project"
npm run atr -- --mode analyze --workspace "C:\project"
npm run atr -- --mode audit-test-ids --workspace "C:\project" --page Transfer --project-prefix transfer --include "src/App.jsx"
npm run atr -- --mode audit-test-ids --workspace "C:\project" --entry-file "src/pages/Transfer.tsx" --follow-imports true
npm run atr -- --mode validate --workspace "C:\project" --entry-file "src/pages/Transfer.tsx" --follow-imports true --feature "src/test/resources/features/transfer.feature"
npm run atr -- --test-command ".\mvnw.cmd test" --scenario "Successful transfer" --html-file "target/failed-page.html"
```

Self-heal remains the default mode and the main ATR responsibility.

## Safety Model

Automatic locator healing may edit only:

```text
src/test/**
```

Production UI source changes, including new `data-test-id` attributes, should start in report-only mode and require explicit approval before apply mode.

Shared test infrastructure files must be protected unless the user explicitly asks to modify them.

## Recommended End-To-End Pipeline

Selector stabilization must happen before smoke-test generation. Generating tests first usually creates brittle locators and noisy healing work.

```text
Analyze project
  -> Load knowledge rules
  -> Audit existing test IDs
  -> Propose missing test IDs
  -> Review audit report
  -> Add or fix data-test-id values with Copilot
  -> Re-run audit until clean
  -> Generate Page Object
  -> Generate Step Definitions
  -> Generate Feature
  -> Run test
  -> Heal if locator breaks
  -> Report
```

## Phase 1: Selector Stabilization

```text
atr_analyze_project
  -> atr_audit_test_ids
     - use entryFile + followImports for pages with child components
  -> Copilot reviews the report
  -> Copilot adds missing unique data-test-id values
  -> atr_audit_test_ids again
  -> atr_validate_test_artifacts
```

This phase is complete only when:

- each relevant interactive/assertable component has a `data-test-id`
- no duplicate `data-test-id` values remain in the scanned page/component graph
- proposed IDs follow the naming convention
- UI behavior was not changed

## Phase 2: Smoke Test Drafting

Copilot drafts the Page Object, Step Definition, and Feature files after selector stabilization.

```text
clean test-id audit
  -> Copilot reads page + child components + existing test style
  -> Copilot asks for business intent if unclear
  -> Copilot drafts Page/Steps/Feature
```

## Phase 3: Execution And Healing

```text
run generated feature
  -> if locator failure: atr_self_heal_scenario
  -> rerun
  -> report
```

`atr_self_heal_scenario` remains the main automatic ATR workflow.
