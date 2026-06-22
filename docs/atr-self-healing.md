# ATR Self-Healing Runner

ATR has a local CLI runner and MCP server. The CLI is useful for direct terminal runs; MCP is the integration point for Continue, Copilot-style agents, or Codex.

## Compile

```powershell
npm run compile
```

## Report-Only Mode

This runs the test, parses the failure, asks Qwen for a healing candidate, writes a report, and does not edit files.

```powershell
npm run atr -- --test-command "mvn test -Dcucumber.filter.name=\"Successful transfer\"" --scenario "Successful transfer" --html-file target/failed-page.html
```

## Alibaba DashScope/Qwen

Do not put API keys in project files. Set the key in your shell:

```powershell
$env:DASHSCOPE_API_KEY = "<your-key>"
```

Then call the OpenAI-compatible Alibaba endpoint:

```powershell
npm run atr -- --test-command "mvn test -Dcucumber.filter.name=\"Successful transfer\"" --scenario "Successful transfer" --html-file target/failed-page.html --ai-provider openai-compatible --ai-profile alibaba-free --ai-model qwen3.7-plus --ai-endpoint "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" --ai-api-key-env DASHSCOPE_API_KEY
```

The `alibaba-free` profile uses conservative local limits:

- `--max-attempts 2`
- `--ai-max-calls-per-run 2`
- `--ai-daily-call-limit 20`
- `--ai-max-prompt-chars 8000`
- `--ai-max-output-tokens 800`

Daily usage is tracked locally in:

```text
target/atr-healer/reports/usage-ledger.json
```

You can lower any limit from the command line, for example:

```powershell
npm run atr -- --test-command "mvn test" --ai-provider openai-compatible --ai-profile alibaba-free --ai-daily-call-limit 5 --ai-max-calls-per-run 1
```

If your Alibaba workspace only supports the DashScope Python SDK multimodal endpoint, use the OpenAI-compatible endpoint once enabled for text self-healing. ATR currently expects chat-completions-style JSON for non-Ollama providers.

## MCP Mode

Compile first:

```powershell
npm run compile
```

Start the MCP server:

```powershell
npm run mcp
```

Tool name:

```text
atr_self_heal_scenario
```

Typical MCP input:

```json
{
  "workspace": "C:\\Users\\serka\\test deneme\\examples\\mock-banking-ui",
  "testCommand": ".\\mvnw.cmd test",
  "feature": "src/test/resources/features/transfer.feature",
  "scenario": "Successful transfer",
  "htmlFile": "target/failed-page.html",
  "approvalMode": "auto-test-files",
  "aiProvider": "openai-compatible",
  "aiProfile": "alibaba-free",
  "aiModel": "qwen3.7-plus",
  "aiEndpoint": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  "aiApiKeyEnv": "DASHSCOPE_API_KEY"
}
```

## Auto Test File Mode

This allows ATR to apply exact text replacements only under `src/test/**`, then rerun the command until it passes, blocks, or reaches `--max-attempts`.

```powershell
npm run atr -- --test-command "mvn test -Dcucumber.filter.name=\"Successful transfer\"" --scenario "Successful transfer" --html-file target/failed-page.html --approval-mode auto-test-files --max-attempts 3
```

ATR refuses to edit production React code in this mode. Adding `data-test-id` attributes to application source should stay an explicit review step unless you later add a separate approved mode for that.

## Expected HTML Context

The first integration should make your Selenide failure hook write the current page HTML to a file such as:

```text
target/failed-page.html
```

Then pass that path with:

```text
--html-file target/failed-page.html
```

## Report Output

Reports are written by default to:

```text
target/atr-healer/reports
```
