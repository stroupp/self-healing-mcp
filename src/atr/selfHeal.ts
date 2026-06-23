import path from 'path';
import { parseFailure } from './failureParser';
import { readHtmlSnippet } from './htmlContext';
import { suggestLocalLocatorHeal } from './localHealer';
import { askForHealCandidate } from './localAiClient';
import { applyCandidate } from './patchApplier';
import { writeReport } from './reportWriter';
import { enrichFailureSourceContext } from './sourceContext';
import { runTestCommand } from './testRunner';
import { AtrCliOptions, HealAttempt, HealReport } from './types';

export async function selfHeal(options: AtrCliOptions): Promise<HealReport> {
  const startedAt = new Date().toISOString();
  const attempts: HealAttempt[] = [];
  let status: HealReport['status'] = 'failed';
  const effectiveMaxAttempts = Math.min(options.maxAttempts, options.aiMaxCallsPerRun);

  for (let attemptNumber = 1; attemptNumber <= effectiveMaxAttempts; attemptNumber++) {
    const run = await runTestCommand(options, attemptNumber);
    const parsedFailure = parseFailure(run);
    const failure = parsedFailure
      ? await enrichFailureSourceContext(options, parsedFailure)
      : undefined;
    const attempt: HealAttempt = { run, failure };
    attempts.push(attempt);

    if (run.exitCode === 0) {
      status = 'passed';
      break;
    }

    if (!failure) {
      status = 'blocked';
      break;
    }

    attempt.htmlSnippet = await readHtmlSnippet(options);

    try {
      attempt.candidate = await askForHealCandidate(
        options,
        failure,
        attempt.htmlSnippet,
        summarizeAttempts(attempts)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const localCandidate = await suggestLocalLocatorHeal(options, failure, attempt.htmlSnippet);

      attempt.candidate = localCandidate ?? {
        status: 'needs_more_context',
        confidence: 'low',
        reasoning: `AI request failed before a heal candidate could be generated: ${message}`,
        changedFiles: [],
        suggestedCommands: []
      };

      if (!localCandidate) {
        status = 'blocked';
        break;
      }
    }

    if (attempt.candidate.status === 'not_healable' || attempt.candidate.status === 'needs_more_context') {
      const localCandidate = await suggestLocalLocatorHeal(options, failure, attempt.htmlSnippet);

      if (!localCandidate) {
        status = 'blocked';
        break;
      }

      localCandidate.reasoning = [
        `Qwen returned ${attempt.candidate.status}: ${attempt.candidate.reasoning}`,
        localCandidate.reasoning
      ].join('\n\n');
      attempt.candidate = localCandidate;
    }

    const applyResult = await applyCandidate(options, attempt.candidate);
    if (!applyResult.applied) {
      status = 'blocked';
      attempt.candidate.reasoning = `${attempt.candidate.reasoning}\n\nApply blocked: ${applyResult.reason}`;
      break;
    }

    status = 'failed';
  }

  const finishedAt = new Date().toISOString();
  const reportPath = path.join(options.workspaceRoot, options.reportDir, reportName(options));
  const report: HealReport = {
    status,
    startedAt,
    finishedAt,
    options,
    attempts,
    reportPath
  };

  await writeReport(report);
  return report;
}

function summarizeAttempts(attempts: HealAttempt[]): string {
  return attempts.map(attempt => [
    `Attempt ${attempt.run.attempt}`,
    `Exit code: ${attempt.run.exitCode}`,
    `Failure: ${attempt.failure?.summary ?? 'none'}`,
    `Candidate: ${attempt.candidate?.status ?? 'none'}`
  ].join('\n')).join('\n\n');
}

function reportName(options: AtrCliOptions): string {
  const base = [
    options.scenarioName,
    options.featureFile,
    new Date().toISOString()
  ]
    .filter(Boolean)
    .join('-')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);

  return `${base || 'atr-heal'}.md`;
}
