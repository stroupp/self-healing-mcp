import { promises as fs } from 'fs';
import path from 'path';
import { HealReport } from './types';

export async function writeReport(report: HealReport): Promise<void> {
  await fs.mkdir(path.dirname(report.reportPath), { recursive: true });
  await fs.writeFile(report.reportPath, renderReport(report), 'utf8');
}

function renderReport(report: HealReport): string {
  const lines = [
    '# ATR Healing Report',
    '',
    `Status: ${report.status}`,
    `Started: ${report.startedAt}`,
    `Finished: ${report.finishedAt}`,
    `Feature: ${report.options.featureFile ?? 'unknown'}`,
    `Scenario: ${report.options.scenarioName ?? 'unknown'}`,
    `Max attempts: ${report.options.maxAttempts}`,
    '',
    '## Attempts',
    ''
  ];

  for (const attempt of report.attempts) {
    lines.push(`### Attempt ${attempt.run.attempt}`);
    lines.push('');
    lines.push(`Command: \`${attempt.run.command}\``);
    lines.push(`Exit code: ${attempt.run.exitCode}`);
    lines.push(`Duration: ${attempt.run.durationMs}ms`);
    lines.push('');

    if (attempt.failure) {
      lines.push('#### Failure');
      lines.push('');
      lines.push(`Summary: ${attempt.failure.summary}`);
      lines.push(`Failed step: ${attempt.failure.failedStep ?? 'unknown'}`);
      lines.push(`Locator: ${attempt.failure.locator ?? 'unknown'}`);
      lines.push(`Exception: ${attempt.failure.exception ?? 'unknown'}`);
      lines.push(`Stack hint: ${attempt.failure.stackHint ?? 'unknown'}`);
      if (attempt.failure.sourceContext) {
        lines.push(`Source context: ${attempt.failure.sourceContext.file}:${attempt.failure.sourceContext.line}`);
        lines.push(`Method: ${attempt.failure.sourceContext.methodName ?? 'unknown'}`);
      }
      lines.push('');
      if (attempt.failure.sourceContext) {
        lines.push('```java');
        lines.push(attempt.failure.sourceContext.content);
        lines.push('```');
        lines.push('');
      }
      lines.push('```text');
      lines.push(attempt.failure.rawTail);
      lines.push('```');
      lines.push('');
    }

    if (attempt.candidate) {
      lines.push('#### Candidate');
      lines.push('');
      lines.push(`Status: ${attempt.candidate.status}`);
      lines.push(`Confidence: ${attempt.candidate.confidence}`);
      lines.push(`Reasoning: ${attempt.candidate.reasoning}`);
      lines.push('');

      if (attempt.candidate.changedFiles.length > 0) {
        lines.push('| File | Reason |');
        lines.push('|---|---|');
        for (const change of attempt.candidate.changedFiles) {
          lines.push(`| ${change.path} | ${change.reason.replace(/\|/g, '\\|')} |`);
        }
        lines.push('');
      }
    }
  }

  return `${lines.join('\n')}\n`;
}
