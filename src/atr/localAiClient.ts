import { AiProvider, AtrCliOptions, FailureContext, HealCandidate } from './types';
import { writeAiCallLog } from './aiCallLogger';
import { assertAiBudget, recordAiCall } from './usageGuard';

export async function askForHealCandidate(
  options: AtrCliOptions,
  failure: FailureContext,
  htmlSnippet: string | undefined,
  attemptHistory: string
): Promise<HealCandidate> {
  const compactRawTail = tail(failure.rawTail, 1400);
  const compactHtml = htmlSnippet ? htmlSnippet.slice(0, 2400) : undefined;
  const compactHistory = tail(attemptHistory || 'none', 700);
  const compactSourceContext = failure.sourceContext
    ? tail(failure.sourceContext.content, 1600)
    : undefined;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: [
        'You are ATR, an enterprise UI test automation self-healing assistant.',
        'Target stack: React, Selenide Java Page Objects, Cucumber Gherkin.',
        'Prefer data-test-id selectors over CSS hierarchy selectors.',
        'Use status "locator_fix" only when replacing a selector/locator string.',
        'Use status "helper_fix" when changing Page Object or helper method logic, assertions, waits, or control flow without replacing a selector string.',
        'Use status "gherkin_fix" only when changing a feature step text or scenario definition.',
        'Never use real customer data, account numbers, credentials, IBANs, or card numbers.',
        'Return only JSON matching this TypeScript shape:',
        '{ "status": "locator_fix|helper_fix|gherkin_fix|not_healable|needs_more_context", "confidence": "low|medium|high", "reasoning": string, "changedFiles": [{ "path": string, "oldText": string, "newText": string, "reason": string }], "suggestedCommands": string[] }',
        'If you cannot identify a safe exact edit, return needs_more_context or not_healable with empty changedFiles.'
      ].join(' ')
    },
    {
      role: 'user',
      content: [
        'Heal this failed Cucumber/Selenide run.',
        `Feature file: ${options.featureFile ?? 'unknown'}`,
        `Scenario: ${options.scenarioName ?? 'unknown'}`,
        `Failure summary: ${failure.summary}`,
        `Failed step: ${failure.failedStep ?? 'unknown'}`,
        `Broken locator: ${failure.locator ?? 'unknown'}`,
        `Exception: ${failure.exception ?? 'unknown'}`,
        `Stack hint: ${failure.stackHint ?? 'unknown'}`,
        `Source context file: ${failure.sourceContext?.file ?? 'unknown'}`,
        `Source context method: ${failure.sourceContext?.methodName ?? 'unknown'}`,
        `Source context:\n${compactSourceContext ?? 'not available'}`,
        `Failure output tail:\n${compactRawTail}`,
        `HTML snippet:\n${compactHtml ?? 'not provided'}`,
        `Previous attempts:\n${compactHistory}`
      ].join('\n\n')
    }
  ];

  await assertAiBudget(options, messages);
  await recordAiCall(options);

  const content = await sendMessages(options, messages);

  return parseCandidate(content);
}

function tail(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(value.length - maxLength) : value;
}

async function sendMessages(
  options: AtrCliOptions,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<string> {
  const apiKey = options.aiApiKeyEnv ? process.env[options.aiApiKeyEnv] : undefined;
  const cookie = options.aiCookieEnv ? process.env[options.aiCookieEnv] : undefined;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (cookie) {
    headers.Cookie = cookie;
  }

  const endpoint = resolveEndpoint(options);
  const requestPayload = buildPayload(options, messages);
  const promptChars = messages.reduce((total, message) => total + message.content.length, 0);
  const startedAt = new Date().toISOString();
  const started = Date.now();

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload)
    });
  } catch (error) {
    const finishedAt = new Date().toISOString();
    await writeAiCallLog(options, {
      startedAt,
      finishedAt,
      durationMs: Date.now() - started,
      endpoint,
      requestPayload,
      error: error instanceof Error ? error.message : String(error),
      promptChars
    });
    throw error;
  }

  const responseText = await response.text();
  const responseBody = parseJsonResponse(responseText);

  if (!response.ok) {
    const finishedAt = new Date().toISOString();
    await writeAiCallLog(options, {
      startedAt,
      finishedAt,
      durationMs: Date.now() - started,
      endpoint,
      requestPayload,
      responseStatus: response.status,
      responseOk: response.ok,
      responseBody,
      responseText,
      error: `AI request failed with ${response.status}`,
      promptChars
    });
    throw new Error(`AI request failed with ${response.status}: ${responseText}`);
  }

  const content = extractContent(options.aiProvider, responseBody);
  const finishedAt = new Date().toISOString();
  await writeAiCallLog(options, {
    startedAt,
    finishedAt,
    durationMs: Date.now() - started,
    endpoint,
    requestPayload,
    responseStatus: response.status,
    responseOk: response.ok,
    responseBody,
    responseText: responseBody ? undefined : responseText,
    extractedContent: content,
    promptChars
  });

  return content;
}

function parseJsonResponse(responseText: string): unknown {
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return undefined;
  }
}

function resolveEndpoint(options: AtrCliOptions): string {
  if (options.aiProvider === 'openai-compatible') {
    const trimmed = options.aiEndpoint.replace(/\/+$/, '');
    if (trimmed.endsWith('/v1')) {
      return `${trimmed}/chat/completions`;
    }

    return options.aiEndpoint;
  }

  if (options.aiProvider !== 'dashscope') {
    return options.aiEndpoint;
  }

  const trimmed = options.aiEndpoint.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) {
    return `${trimmed}/services/aigc/multimodal-generation/generation`;
  }

  return options.aiEndpoint;
}

function buildPayload(
  options: AtrCliOptions,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): unknown {
  if (options.aiProvider === 'dashscope') {
    return {
      model: options.aiModel,
      input: {
        messages: messages.map(message => ({
          role: message.role,
          content: [
            {
              text: message.content
            }
          ]
        }))
      },
      parameters: {
        temperature: options.aiTemperature,
        max_tokens: options.aiMaxOutputTokens
      }
    };
  }

  if (options.aiProvider === 'openai-compatible') {
    const payload: Record<string, unknown> = {
      model: options.aiModel,
      temperature: options.aiTemperature,
      max_tokens: options.aiMaxOutputTokens,
      messages
    };

    if (options.aiUseJsonResponseFormat) {
      payload.response_format = {
        type: 'json_object'
      };
    }

    return payload;
  }

  return {
    model: options.aiModel,
    stream: false,
    options: {
      temperature: options.aiTemperature,
      num_predict: options.aiMaxOutputTokens
    },
    messages
  };
}

function extractContent(provider: AiProvider, json: unknown): string {
  if (!json || typeof json !== 'object') {
    return '';
  }

  const record = json as Record<string, unknown>;
  if (provider === 'dashscope') {
    const output = record.output as Record<string, unknown> | undefined;
    const choices = output?.choices as Array<Record<string, unknown>> | undefined;
    const message = choices?.[0]?.message as Record<string, unknown> | undefined;
    const content = message?.content as Array<Record<string, unknown>> | undefined;
    const firstText = content?.find(item => typeof item.text === 'string')?.text;
    return typeof firstText === 'string' ? firstText : '';
  }

  if (provider === 'ollama') {
    const message = record.message as Record<string, unknown> | undefined;
    return typeof message?.content === 'string' ? message.content : '';
  }

  const choices = record.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  return typeof message?.content === 'string' ? message.content : '';
}

function parseCandidate(content: string): HealCandidate {
  const normalized = extractJson(stripCodeFence(content.trim()));
  const parsed = JSON.parse(normalized) as HealCandidate;

  return {
    status: parsed.status,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    changedFiles: Array.isArray(parsed.changedFiles) ? parsed.changedFiles : [],
    suggestedCommands: Array.isArray(parsed.suggestedCommands) ? parsed.suggestedCommands : []
  };
}

function stripCodeFence(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
}

function extractJson(value: string): string {
  const firstBrace = value.indexOf('{');
  const lastBrace = value.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return value.slice(firstBrace, lastBrace + 1);
  }

  return value;
}
