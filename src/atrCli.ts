#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { validateArtifacts } from './atr/artifactValidator';
import { loadAtrKnowledge, summarizeKnowledge } from './atr/knowledgeBase';
import { analyzeProject } from './atr/projectAnalyzer';
import { selfHeal } from './atr/selfHeal';
import { auditTestIds } from './atr/testIdAuditor';
import { writeTestIdAuditReport } from './atr/testIdReportWriter';
import { AiProvider, AtrCliOptions } from './atr/types';

type AtrMode = 'self-heal' | 'knowledge' | 'analyze' | 'audit-test-ids' | 'validate' | 'init' | 'mcp-config';

interface ParsedArgs {
  args: string[];
  mode: AtrMode;
}

async function main(): Promise<void> {
  const parsed = parseMode(process.argv.slice(2));

  if (!parsed) {
    printHelp();
    return;
  }

  if (parsed.mode === 'knowledge') {
    await runKnowledgeMode(parsed.args);
    return;
  }

  if (parsed.mode === 'analyze') {
    await runAnalyzeMode(parsed.args);
    return;
  }

  if (parsed.mode === 'audit-test-ids') {
    await runAuditTestIdsMode(parsed.args);
    return;
  }

  if (parsed.mode === 'validate') {
    await runValidateMode(parsed.args);
    return;
  }

  if (parsed.mode === 'init') {
    await runInitMode(parsed.args);
    return;
  }

  if (parsed.mode === 'mcp-config') {
    runMcpConfigMode(parsed.args);
    return;
  }

  const options = parseSelfHealArgs(parsed.args);
  if (!options) {
    printHelp();
    return;
  }

  const report = await selfHeal(options);
  console.log(`ATR healing finished with status: ${report.status}`);
  console.log(`Report: ${report.reportPath}`);

  if (report.status !== 'passed') {
    process.exitCode = 1;
  }
}

async function runKnowledgeMode(args: string[]): Promise<void> {
  const read = argReader(args);
  const workspaceRoot = path.resolve(read('--workspace') ?? process.cwd());
  const knowledge = await loadAtrKnowledge({
    workspaceRoot,
    knowledgeFile: read('--knowledge-file')
  });
  console.log(JSON.stringify(summarizeKnowledge(knowledge), null, 2));
}

async function runAnalyzeMode(args: string[]): Promise<void> {
  const read = argReader(args);
  const workspaceRoot = path.resolve(read('--workspace') ?? process.cwd());
  const knowledge = await loadAtrKnowledge({
    workspaceRoot,
    knowledgeFile: read('--knowledge-file')
  });
  const analysis = await analyzeProject(workspaceRoot, knowledge);
  console.log(JSON.stringify(analysis, null, 2));
}

async function runAuditTestIdsMode(args: string[]): Promise<void> {
  const read = argReader(args);
  const workspaceRoot = path.resolve(read('--workspace') ?? process.cwd());
  const knowledge = await loadAtrKnowledge({
    workspaceRoot,
    knowledgeFile: read('--knowledge-file')
  });
  const report = await auditTestIds(
    {
      workspaceRoot,
      pageName: read('--page'),
      projectPrefix: read('--project-prefix'),
      include: readAll(args, '--include'),
      entryFile: read('--entry-file'),
      followImports: read('--follow-imports') === 'true',
      maxFiles: Number(read('--max-files') ?? '200')
    },
    knowledge
  );
  const reportPath = await writeTestIdAuditReport(report, read('--report-dir') ?? 'target/atr-healer/reports');

  console.log(`ATR test-id audit completed.`);
  console.log(`Scanned files: ${report.scannedFiles.length}`);
  console.log(`Existing test IDs: ${report.existing.length}`);
  console.log(`Duplicate test IDs: ${report.duplicates.length}`);
  console.log(`Proposals: ${report.proposals.length}`);
  console.log(`Report: ${reportPath}`);
}

async function runValidateMode(args: string[]): Promise<void> {
  const read = argReader(args);
  const workspaceRoot = path.resolve(read('--workspace') ?? process.cwd());
  const knowledge = await loadAtrKnowledge({
    workspaceRoot,
    knowledgeFile: read('--knowledge-file')
  });
  const report = await validateArtifacts(
    {
      workspaceRoot,
      pageName: read('--page'),
      projectPrefix: read('--project-prefix'),
      include: readAll(args, '--include'),
      entryFile: read('--entry-file'),
      followImports: read('--follow-imports') === 'true',
      maxFiles: Number(read('--max-files') ?? '200'),
      featureFile: read('--feature')
    },
    knowledge
  );

  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'passed') {
    process.exitCode = 1;
  }
}

async function runInitMode(args: string[]): Promise<void> {
  const read = argReader(args);
  const workspaceRoot = path.resolve(read('--workspace') ?? process.cwd());
  const force = read('--force') === 'true';
  const templateRoot = path.resolve(__dirname, '..', 'templates');
  const files = await listTemplateFiles(templateRoot);

  for (const source of files) {
    const relative = path.relative(templateRoot, source);
    const target = path.join(workspaceRoot, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });

    if (!force && await exists(target)) {
      console.log(`skip ${relative}`);
      continue;
    }

    await fs.copyFile(source, target);
    console.log(`write ${relative}`);
  }
}

function runMcpConfigMode(args: string[]): void {
  const read = argReader(args);
  const optionalTools = read('--optional-tools') === 'true';
  const command = read('--command') ?? 'npx';
  const argsValue = command === 'npx' ? ['atr-mcp'] : [path.resolve(__dirname, 'mcpServer.js')];
  const config = {
    mcpServers: {
      atr: {
        command,
        args: argsValue,
        env: optionalTools
          ? {
              ATR_MCP_ENABLE_OPTIONAL_TOOLS: 'true'
            }
          : undefined
      }
    }
  };

  console.log(JSON.stringify(removeUndefined(config), null, 2));
}

function parseMode(args: string[]): ParsedArgs | undefined {
  if (args.includes('--help') || args.includes('-h')) {
    return undefined;
  }

  const modeIndex = args.indexOf('--mode');
  if (modeIndex >= 0) {
    const mode = args[modeIndex + 1] as AtrMode | undefined;
    const rest = args.filter((_, index) => index !== modeIndex && index !== modeIndex + 1);
    if (
      mode === 'self-heal' ||
      mode === 'knowledge' ||
      mode === 'analyze' ||
      mode === 'audit-test-ids' ||
      mode === 'validate' ||
      mode === 'init' ||
      mode === 'mcp-config'
    ) {
      return {
        mode,
        args: rest
      };
    }

    throw new Error(`Unsupported --mode: ${mode}`);
  }

  return {
    mode: 'self-heal',
    args
  };
}

async function listTemplateFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        files.push(absolute);
      }
    }
  }

  await walk(root);
  return files;
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => removeUndefined(item)) as T;
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
      if (childValue !== undefined) {
        output[key] = removeUndefined(childValue);
      }
    }
    return output as T;
  }

  return value;
}

function parseSelfHealArgs(args: string[]): AtrCliOptions | undefined {
  const read = argReader(args);
  const testCommand = read('--test-command');
  if (!testCommand) {
    return undefined;
  }

  const profile = read('--ai-profile');
  const provider = read('--ai-provider') ?? defaultProvider(profile);
  if (provider !== 'ollama' && provider !== 'openai-compatible' && provider !== 'dashscope') {
    throw new Error(`Unsupported --ai-provider: ${provider}`);
  }

  const defaults = profile === 'alibaba-free'
    ? alibabaFreeDefaults()
    : profile === 'local-coder'
      ? localCoderDefaults()
      : defaultAiDefaults();

  return {
    workspaceRoot: path.resolve(read('--workspace') ?? process.cwd()),
    testCommand,
    featureFile: read('--feature'),
    scenarioName: read('--scenario'),
    htmlFile: read('--html-file'),
    maxAttempts: Number(read('--max-attempts') ?? defaults.maxAttempts),
    reportDir: read('--report-dir') ?? 'target/atr-healer/reports',
    aiEndpoint: read('--ai-endpoint') ?? defaults.endpoint,
    aiModel: read('--ai-model') ?? defaults.model,
    aiProvider: provider as AiProvider,
    aiApiKeyEnv: read('--ai-api-key-env') ?? defaultApiKeyEnv(provider as AiProvider, profile),
    aiCookieEnv: read('--ai-cookie-env') ?? defaults.cookieEnv,
    aiTemperature: Number(read('--ai-temperature') ?? defaults.temperature),
    aiUseJsonResponseFormat: (read('--ai-use-json-response-format') ?? defaults.useJsonResponseFormat) === 'true',
    aiMaxCallsPerRun: Number(read('--ai-max-calls-per-run') ?? defaults.maxCallsPerRun),
    aiDailyCallLimit: Number(read('--ai-daily-call-limit') ?? defaults.dailyCallLimit),
    aiMaxPromptChars: Number(read('--ai-max-prompt-chars') ?? defaults.maxPromptChars),
    aiMaxOutputTokens: Number(read('--ai-max-output-tokens') ?? defaults.maxOutputTokens),
    aiLogDir: read('--ai-log-dir') ?? 'target/atr-healer/ai-logs',
    approvalMode: read('--approval-mode') === 'auto-test-files' ? 'auto-test-files' : 'report'
  };
}

function defaultProvider(profile?: string): AiProvider {
  return profile === 'alibaba-free' || profile === 'local-coder'
    ? 'openai-compatible'
    : 'ollama';
}

function argReader(args: string[]): (name: string) => string | undefined {
  return (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
}

function readAll(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === name && args[index + 1]) {
      values.push(args[index + 1]);
    }
  }

  return values;
}

function defaultAiDefaults(): {
  endpoint: string;
  model: string;
  maxAttempts: string;
  maxCallsPerRun: string;
  dailyCallLimit: string;
  maxPromptChars: string;
  maxOutputTokens: string;
  temperature: string;
  useJsonResponseFormat: string;
  cookieEnv?: string;
} {
  return {
    endpoint: 'http://localhost:11434/api/chat',
    model: 'qwen3',
    maxAttempts: '3',
    maxCallsPerRun: '3',
    dailyCallLimit: '50',
    maxPromptChars: '12000',
    maxOutputTokens: '1200',
    temperature: '0',
    useJsonResponseFormat: 'false'
  };
}

function alibabaFreeDefaults(): ReturnType<typeof defaultAiDefaults> {
  return {
    endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.7-plus',
    maxAttempts: '2',
    maxCallsPerRun: '2',
    dailyCallLimit: '20',
    maxPromptChars: '8000',
    maxOutputTokens: '800',
    temperature: '0',
    useJsonResponseFormat: 'true'
  };
}

function localCoderDefaults(): ReturnType<typeof defaultAiDefaults> {
  return {
    endpoint: process.env.ATR_LOCAL_CODER_ENDPOINT ?? 'http://localhost:8000/v1/chat/completions',
    model: 'ONIKS',
    maxAttempts: '3',
    maxCallsPerRun: '999',
    dailyCallLimit: '999999',
    maxPromptChars: '1000000',
    maxOutputTokens: '163849',
    temperature: '0.6',
    useJsonResponseFormat: 'false',
    cookieEnv: 'ATR_LOCAL_CODER_COOKIE'
  };
}

function defaultApiKeyEnv(provider: AiProvider, profile?: string): string | undefined {
  if (profile === 'local-coder') {
    return undefined;
  }

  return provider === 'openai-compatible' || provider === 'dashscope' ? 'DASHSCOPE_API_KEY' : undefined;
}

function printHelp(): void {
  console.log(`ATR runner

Usage:
  atr --test-command "<command>" [self-heal options]
  atr --mode knowledge [options]
  atr --mode analyze [options]
  atr --mode audit-test-ids [options]
  atr --mode validate [options]
  atr --mode init [options]
  atr --mode mcp-config [options]

Modes:
  self-heal       Default. Run, heal, rerun, and report a Cucumber/Selenide scenario.
  knowledge       Print normalized ATR knowledge summary as JSON.
  analyze         Inspect project structure as JSON.
  audit-test-ids  Report missing React data-test-id candidates. Does not edit files.
  validate        Validate test-id audit cleanliness and optional feature-step bindings.
  init            Copy ATR Copilot instructions, prompts, agents, and docs into a project.
  mcp-config      Print MCP configuration JSON.

Common options:
  --workspace        Workspace root. Defaults to current directory.
  --knowledge-file   Optional knowledge markdown path.
  --report-dir       Report output directory. Defaults to target/atr-healer/reports.
  --force            init mode only. true overwrites existing template files.
  --optional-tools   mcp-config mode only. true enables optional ATR MCP tools.

Audit options:
  --page             Page name used in proposed IDs.
  --project-prefix   Project prefix used in proposed IDs.
  --include          Workspace-relative React file to scan. Can be repeated.
  --entry-file       Workspace-relative page entry file to scan.
  --follow-imports   true to scan local imports reachable from --entry-file.
  --max-files        Max React files to scan. Defaults to 200.

Self-heal required:
  --test-command     Command that runs the failed Cucumber/Selenide test.

Self-heal options:
  --feature          Feature file path for reporting/context.
  --scenario         Scenario name for reporting/context.
  --html-file        HTML snippet file captured from the failed page.
  --max-attempts     Maximum retry attempts. Defaults to 3.
  --ai-endpoint      Local LLM endpoint. Defaults to http://localhost:11434/api/chat.
  --ai-model         Local LLM model. Defaults to qwen3.
  --ai-provider      ollama, openai-compatible, or dashscope. Defaults to ollama.
  --ai-profile       Optional preset. Use alibaba-free or local-coder.
  --ai-api-key-env   Environment variable containing API key.
  --ai-cookie-env    Environment variable containing Cookie header for local/private LLM routes.
  --ai-temperature   Model temperature. Defaults depend on profile.
  --ai-use-json-response-format true/false. Defaults true for alibaba-free, false for local-coder.
  --ai-log-dir       Directory for one JSON log per AI API request. Defaults to target/atr-healer/ai-logs.
  --approval-mode    report or auto-test-files. Defaults to report.

Examples:
  atr --mode analyze --workspace "C:\\project"
  atr --mode audit-test-ids --workspace "C:\\project" --page Transfer --project-prefix transfer --include "src/App.jsx"
  atr --mode audit-test-ids --workspace "C:\\project" --entry-file "src/pages/Transfer.tsx" --follow-imports true
  atr --mode validate --workspace "C:\\project" --entry-file "src/pages/Transfer.tsx" --follow-imports true --feature "src/test/resources/features/transfer.feature"
  atr --mode init --workspace "C:\\project"
  atr --mode mcp-config --optional-tools true
  atr --test-command ".\\mvnw.cmd test" --ai-profile local-coder --ai-endpoint "$env:ATR_LOCAL_CODER_ENDPOINT" --ai-cookie-env ATR_LOCAL_CODER_COOKIE --approval-mode auto-test-files
  atr --test-command "mvn test" --scenario "Successful transfer" --html-file target/failed-page.html --approval-mode auto-test-files
`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
