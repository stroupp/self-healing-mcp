# Codex Project Instructions

See `docs/codex-atr-usage.md` for the detailed ATR playbook.

## ATR Feature Testing Workflow

When the user says "try the feature", "test it", or similar, run the relevant Cucumber/Selenide test for the current feature.

If the test fails because of a broken locator, use ATR to heal it.

Default ATR workflow:

1. Run the matching test command.
2. If it fails, inspect the failure output and `target/failed-page.html`.
3. Run ATR with `--approval-mode auto-test-files`.
4. Allow ATR to modify only test automation files under `src/test/**`.
5. Prefer `data-test-id` selectors.
6. Rerun the test after ATR applies a fix.
7. Continue until the test passes, ATR blocks, or max attempts are reached.
8. Summarize the result with:
   - failed scenario
   - broken locator
   - healed locator
   - changed file
   - ATR report path
   - final test status

Use this ATR command pattern:

```powershell
npm run atr -- --workspace "<project-path>" --test-command ".\\mvnw.cmd test" --feature "<feature-file>" --scenario "<scenario-name>" --html-file "target/failed-page.html" --approval-mode auto-test-files --ai-provider openai-compatible --ai-profile alibaba-free --ai-model qwen3.7-plus --ai-endpoint "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" --ai-api-key-env DASHSCOPE_API_KEY
```

Never automatically edit production source files. Only auto-apply exact locator/helper changes under `src/test/**`. If ATR cannot safely heal the test, stop and show the report path with the reason.
