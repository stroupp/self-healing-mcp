---
name: atr-self-heal
invokable: true
---

Use ATR self-healing for the selected Cucumber/Selenide failure.

Ask me for the feature file, scenario name, test command, and failed page HTML path if they are missing.

Prefer this command shape:

```powershell
npm run atr -- --workspace "<repo>" --test-command "<test command>" --feature "<feature file>" --scenario "<scenario>" --html-file "<html file>" --approval-mode auto-test-files --max-attempts 2 --ai-provider openai-compatible --ai-profile alibaba-free --ai-model qwen3.7-plus --ai-endpoint "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" --ai-api-key-env DASHSCOPE_API_KEY
```

Summarize the ATR report after the run.

---
name: generate-data-test-ids
invokable: true
---

Add stable data-test-id attributes to a React enterprise UI page.

Find important components:
- form fields
- buttons
- dropdowns
- validation messages
- tables
- tabs
- dialogs
- confirmation panels

Use kebab-case names based on business meaning. Do not modify production behavior.

---
name: generate-smoke-test
invokable: true
---

Generate a Cucumber + Selenide smoke test for this enterprise UI flow.

Return:
1. Gherkin scenario
2. Page object locators
3. Java helper methods
4. Test data assumptions

Prefer data-test-id selectors and keep the scenario short.

---
name: heal-locator
invokable: true
---

Heal the broken Selenide locator using the provided component or HTML context.

Prefer:
1. data-test-id
2. accessible role/name
3. stable semantic selector

Avoid brittle CSS hierarchy selectors. Return old locator, new locator, confidence, and reasoning.
