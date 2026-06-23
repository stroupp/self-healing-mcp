# ATR Healer

ATR means **Automation Test Resilience**.

This project is now a local self-healing runner and MCP server for Selenide + Cucumber regression tests. It is not a VS Code extension anymore.

## What It Does

```text
Copilot / Continue / Codex
  -> ATR MCP tool or ATR CLI
  -> Cucumber/Selenide test run
  -> failed locator + failed page HTML
  -> Qwen / local fallback healer
  -> safe patch under src/test/**
  -> rerun test
  -> Markdown report
```

ATR is designed for Java test automation projects that use Page Objects and stable `data-test-id` selectors.

## Commands

Compile ATR:

```powershell
npm run compile
```

## NPM Package Usage

After ATR is published or packed, users can run it without cloning this repository:

```powershell
npm install --save-dev atr-healer
npx atr --mode init
npx atr --mode mcp-config --optional-tools true
```

Global install is also possible:

```powershell
npm install -g atr-healer
atr --mode init --workspace "C:\path\to\project"
atr --mode mcp-config --optional-tools true
```

`atr --mode init` copies lightweight Copilot instructions, prompts, agents, and ATR docs into the target project.

`atr --mode mcp-config` prints MCP configuration JSON that can be pasted into Copilot/Continue MCP settings.

Before self-healing, the target test project should have a Cucumber failure hook that writes `target/failed-page.html`. If it is missing, use the installed `docs/atr-failure-hook.md` instructions to add it under `src/test/**` before running ATR.

## Local Coder LLM

For an internal OpenAI-compatible local coder model, use the `local-coder` profile. Keep private endpoints and cookies in environment variables:

```powershell
$env:ATR_LOCAL_CODER_ENDPOINT = "https://<local-llm-host>/v1/chat/completions"
$env:ATR_LOCAL_CODER_COOKIE = "<cookie-name>=<cookie-value>"

atr --workspace "C:\path\to\test-project" `
  --test-command ".\mvnw.cmd test" `
  --feature "src/test/resources/features/example.feature" `
  --scenario "Scenario name" `
  --html-file "target/failed-page.html" `
  --approval-mode auto-test-files `
  --ai-profile local-coder `
  --ai-endpoint "$env:ATR_LOCAL_CODER_ENDPOINT" `
  --ai-cookie-env ATR_LOCAL_CODER_COOKIE
```

`local-coder` defaults:

- provider: `openai-compatible`
- model: `ONIKS`
- temperature: `0.6`
- max output tokens: `163849`
- JSON response format parameter: disabled
- API call logs: `target/atr-healer/ai-logs`

Run the CLI:

```powershell
npm run atr -- --workspace "C:\path\to\test-project" --test-command ".\\mvnw.cmd test" --feature "src/test/resources/features/transfer.feature" --scenario "Successful transfer" --html-file "target/failed-page.html" --approval-mode auto-test-files --ai-provider openai-compatible --ai-profile alibaba-free --ai-model qwen3.7-plus --ai-endpoint "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" --ai-api-key-env DASHSCOPE_API_KEY
```

Other CLI modes:

```powershell
npm run atr -- --mode knowledge --workspace "C:\path\to\project"
npm run atr -- --mode analyze --workspace "C:\path\to\project"
npm run atr -- --mode audit-test-ids --workspace "C:\path\to\project" --page Transfer --project-prefix transfer --include "src/App.jsx"
```

Start the MCP server:

```powershell
npm run mcp
```

Current MCP tools:

```text
atr_knowledge_summary
atr_analyze_project
atr_self_heal_scenario
```

Optional MCP tools are hidden by default. Enable them when you want Copilot/Continue to access generation-prep workflows:

```powershell
$env:ATR_MCP_ENABLE_OPTIONAL_TOOLS = "true"
npm run mcp
```

Optional tools currently include:

```text
atr_audit_test_ids
```

## Qwen Configuration

Keep the DashScope key in your environment:

```powershell
$env:DASHSCOPE_API_KEY = "<your-key>"
```

For a permanent Windows user variable:

```powershell
setx DASHSCOPE_API_KEY "<your-key>"
```

Open a new terminal after `setx`.

## Safety

In `auto-test-files` mode, ATR only applies exact changes under:

```text
src/test/**
```

It must not patch production React source automatically. Adding or changing `data-test-id` attributes in UI code should be a separate reviewed change.

## Docs

- `docs/atr-self-healing.md`
- `docs/atr-knowledge-architecture.md`
- `docs/codex-atr-usage.md`
- `docs/continue-config.example.yaml`
- `docs/continue-prompts.md`

## Mock Project

The example project lives under:

```text
examples/mock-banking-ui
```

It contains a small React page plus Selenide/Cucumber tests for demonstrating locator healing.
