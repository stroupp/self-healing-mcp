import { promises as fs } from 'fs';
import path from 'path';
import { AtrCliOptions } from './types';

export interface AiCallLogInput {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  endpoint: string;
  requestPayload: unknown;
  responseStatus?: number;
  responseOk?: boolean;
  responseBody?: unknown;
  responseText?: string;
  extractedContent?: string;
  error?: string;
  promptChars: number;
}

export async function writeAiCallLog(options: AtrCliOptions, input: AiCallLogInput): Promise<string | undefined> {
  try {
    const absoluteDir = path.isAbsolute(options.aiLogDir)
      ? options.aiLogDir
      : path.join(options.workspaceRoot, options.aiLogDir);
    await fs.mkdir(absoluteDir, { recursive: true });

    const fileName = `${safeName(options.scenarioName ?? 'ai-call')}-${input.startedAt.replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(absoluteDir, fileName);
    const log = {
      kind: 'atr-ai-call',
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      durationMs: input.durationMs,
      scenario: options.scenarioName,
      feature: options.featureFile,
      provider: options.aiProvider,
      model: options.aiModel,
      endpoint: input.endpoint,
      apiKeyEnv: options.aiApiKeyEnv,
      promptChars: input.promptChars,
      maxPromptChars: options.aiMaxPromptChars,
      maxOutputTokens: options.aiMaxOutputTokens,
      responseStatus: input.responseStatus,
      responseOk: input.responseOk,
      requestPayload: input.requestPayload,
      responseBody: input.responseBody,
      responseText: input.responseText,
      extractedContent: input.extractedContent,
      error: input.error
    };

    await fs.writeFile(filePath, `${JSON.stringify(log, null, 2)}\n`, 'utf8');
    return filePath;
  } catch (error) {
    console.warn(`ATR could not write AI call log: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function safeName(value: string): string {
  return value
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'ai-call';
}
