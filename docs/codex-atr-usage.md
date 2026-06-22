# Codex ATR Usage Instructions

This file is a working playbook for Codex when operating in this repository.

## What ATR Means

ATR means **Automation Test Resilience**.

ATR is a local self-healing test automation runner for:

- Selenide Java Page Objects
- Cucumber feature files
- React UI pages using `data-test-id`
- Alibaba Qwen via DashScope/OpenAI-compatible API
- optional local fallback healing from failed HTML

The main command is:

```powershell
npm run atr -- ...
```

## When To Use ATR

Use ATR when the user says something like:

- "try the feature"
- "test it"
- "run the scenario"
- "fix the broken locator"
- "heal this test"
- "run ATR"
- "the locator is broken"

Use ATR after a Cucumber/Selenide test fails with symptoms like:

- `Element not found`
- `NoSuchElementException`
- `Unable to locate element`
- stale or changed `data-test-id`
- broken Selenide selector in a Page Object

## When Not To Use ATR

Do not use ATR for:

- production React logic changes
- backend/API failures
- test data failures
- authentication/environment failures
- visual assertion issues unrelated to locators
- broad refactors

If the failure is not locator-related, explain the failure and do not force ATR.

## Safety Rules

ATR may auto-edit only test automation files under:

```text
src/test/**
```

ATR must not automatically edit production UI code.

Production React changes, including adding `data-test-id`, should be proposed as patches or reviewed changes unless the user explicitly asks to apply them.

Prefer selectors based on:

```text
data-test-id
```

Never store API keys in source files. Use:

```powershell
$env:DASHSCOPE_API_KEY
```

## Standard Mock Project Paths

Mock project:

```text
examples/mock-banking-ui
```

Feature:

```text
src/test/resources/features/transfer.feature
```

Page Object:

```text
src/test/java/com/example/mockbanking/pages/TransferPage.java
```

Failed page HTML:

```text
target/failed-page.html
```

ATR reports:

```text
target/atr-healer/reports
```

## Standard Test Command

For the mock project:

```powershell
.\mvnw.cmd test
```

From the ATR workspace, the full ATR command is:

```powershell
npm run atr -- --workspace "C:\Users\serka\test deneme\examples\mock-banking-ui" --test-command ".\\mvnw.cmd test" --feature "src/test/resources/features/transfer.feature" --scenario "Successful transfer" --html-file "target/failed-page.html" --approval-mode auto-test-files --ai-provider openai-compatible --ai-profile alibaba-free --ai-model qwen3.7-plus --ai-endpoint "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" --ai-api-key-env DASHSCOPE_API_KEY
```

If `DASHSCOPE_API_KEY` is missing, ATR can still use local fallback healing for simple `data-test-id` cases.

## Expected Workflow

1. Confirm the app is running.
2. Run the Selenide/Cucumber test.
3. If it fails, inspect the locator error.
4. Confirm `target/failed-page.html` exists.
5. Run ATR.
6. Read the ATR report.
7. Confirm the changed Page Object locator.
8. Confirm the rerun passed.
9. Summarize the outcome.

## Summary Format

When reporting an ATR run, include:

- scenario name
- first attempt status
- broken locator
- healed locator
- changed file
- whether Qwen or local fallback was used
- final attempt status
- ATR report path

Example:

```text
Scenario: Successful transfer
Broken locator: [data-test-id='wrong-submit-button']
Healed locator: [data-test-id='transfer-submit-button']
Changed file: TransferPage.java
Healing source: Qwen
Final result: passed on attempt 2
Report: target/atr-healer/reports/...
```

## Qwen Configuration

Use Alibaba compatible mode:

```text
Provider: openai-compatible
Model: qwen3.7-plus
Endpoint: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
API key env: DASHSCOPE_API_KEY
```

ATR appends `/chat/completions` automatically when needed.

## Free-Tier Guard

Use:

```text
--ai-profile alibaba-free
```

This applies conservative limits:

- max 2 attempts
- max 2 AI calls per run
- local daily usage guard
- compact prompt size
- limited output tokens

## Healenium Future Usage

Healenium is not required for the current ATR CLI flow.

Future architecture:

```text
Selenide Test
  ↓
Healenium Proxy / WebDriver
  ↓
Runtime locator healing
  ↓
Healenium backend stores healing result
  ↓
ATR consumes healing result
  ↓
ATR patches Page Object
  ↓
ATR reruns and reports
```

Use this framing:

```text
Healenium finds the element at runtime.
ATR turns the runtime healing result into a permanent Page Object fix.
```

## Continue / MCP Usage

ATR can be used as a CLI or as an MCP server.

MCP tool name:

```text
atr_self_heal_scenario
```

Expected input:

```json
{
  "workspace": "C:\\path\\to\\project",
  "testCommand": ".\\mvnw.cmd test",
  "feature": "src/test/resources/features/transfer.feature",
  "scenario": "Successful transfer",
  "htmlFile": "target/failed-page.html",
  "approvalMode": "auto-test-files"
}
```

Compile before using MCP:

```powershell
npm run compile
```
