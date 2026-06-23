# Mock Banking UI

Small project for testing ATR self-healing.

It contains:

- React UI with stable `data-test-id` attributes
- Cucumber feature
- Selenide Page Object and Cucumber TestNG steps
- One intentionally broken locator
- Failure hook that writes `target/failed-page.html`

## Required Local Tools

- Java 17
- Maven is optional. `mvnw.cmd` downloads Maven 3.9.9 locally if `mvn` is not installed.
- Node.js 20+
- Chrome
- VS Code extensions:
  - Extension Pack for Java
  - Cucumber
  - TestNG for Java, optional but useful

## Run UI

```powershell
npm install
npm run dev
```

The app runs on:

```text
http://localhost:5173
```

## Run Tests

From this folder:

```powershell
.\mvnw.cmd test
```

The project is configured to use the ChromeDriver placed at:

```text
C:\Users\serka\test deneme\chromedriver.exe
```

via this Maven property:

```xml
<webdriver.chrome.driver>${project.basedir}/../../chromedriver.exe</webdriver.chrome.driver>
```

If you move the driver, update `pom.xml` or pass:

```powershell
.\mvnw.cmd test -Dwebdriver.chrome.driver="C:\path\to\chromedriver.exe"
```

This project uses:

- Selenide `7.8.1`
- Cucumber Java `7.15.0`
- Cucumber TestNG `7.15.0`
- TestNG `7.10.2`

The test intentionally fails because `TransferPage.java` looks for:

```java
[data-test-id='wrong-submit-button']
```

but the React UI contains:

```html
data-test-id="transfer-submit-button"
```

## Run ATR From Main Project

From the ATR project root:

```powershell
npm run compile

npm run atr -- `
  --workspace "C:\Users\serka\test deneme\examples\mock-banking-ui" `
  --test-command ".\mvnw.cmd test" `
  --feature "src/test/resources/features/transfer.feature" `
  --scenario "Successful transfer" `
  --html-file "target/failed-page.html" `
  --approval-mode auto-test-files `
  --ai-provider openai-compatible `
  --ai-profile alibaba-free `
  --ai-endpoint "https://<workspace-id>.ap-southeast-1.maas.aliyuncs.com/api/v1/chat/completions" `
  --ai-api-key-env DASHSCOPE_API_KEY
```

## Run From VS Code

Open this folder in VS Code:

```text
C:\Users\serka\test deneme\examples\mock-banking-ui
```

Then run tasks with:

```text
Terminal: Run Task
```

Recommended order:

1. `UI: install dependencies`
2. `UI: start dev server`
3. `Tests: run successful transfer`
4. `ATR: heal successful transfer`

Before running the ATR task, replace `<workspace-id>` in `.vscode/tasks.json` and set:

