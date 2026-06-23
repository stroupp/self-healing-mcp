export type AiProvider = 'ollama' | 'openai-compatible' | 'dashscope';

export interface AtrCliOptions {
  workspaceRoot: string;
  testCommand: string;
  featureFile?: string;
  scenarioName?: string;
  htmlFile?: string;
  maxAttempts: number;
  reportDir: string;
  aiEndpoint: string;
  aiModel: string;
  aiProvider: AiProvider;
  aiApiKeyEnv?: string;
  aiCookieEnv?: string;
  aiTemperature: number;
  aiUseJsonResponseFormat: boolean;
  aiMaxCallsPerRun: number;
  aiDailyCallLimit: number;
  aiMaxPromptChars: number;
  aiMaxOutputTokens: number;
  aiLogDir: string;
  approvalMode: 'report' | 'auto-test-files';
}

export interface TestRunResult {
  attempt: number;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface FailureContext {
  summary: string;
  failedStep?: string;
  locator?: string;
  exception?: string;
  stackHint?: string;
  sourceContext?: SourceContext;
  rawTail: string;
}

export interface SourceContext {
  file: string;
  line: number;
  methodName?: string;
  content: string;
}

export interface HealCandidate {
  status: 'locator_fix' | 'helper_fix' | 'gherkin_fix' | 'not_healable' | 'needs_more_context';
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  changedFiles: Array<{
    path: string;
    oldText: string;
    newText: string;
    reason: string;
  }>;
  suggestedCommands: string[];
}

export interface HealAttempt {
  run: TestRunResult;
  failure?: FailureContext;
  htmlSnippet?: string;
  candidate?: HealCandidate;
}

export interface HealReport {
  status: 'passed' | 'failed' | 'blocked';
  startedAt: string;
  finishedAt: string;
  options: AtrCliOptions;
  attempts: HealAttempt[];
  reportPath: string;
}
