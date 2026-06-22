import { FailureContext, TestRunResult } from './types';

const locatorPatterns = [
  /(?:shadowCss|css|\$)\(\s*"([^"]+)"/,
  /Element not found[:\s]+([^\r\n]+)/i,
  /NoSuchElementException[:\s]+([^\r\n]+)/i,
  /Unable to locate element[:\s]+([^\r\n]+)/i
];

export function parseFailure(run: TestRunResult): FailureContext | undefined {
  if (run.exitCode === 0) {
    return undefined;
  }

  const combined = `${run.stdout}\n${run.stderr}`;
  const lines = combined.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const rawTail = lines.slice(-80).join('\n');

  return {
    summary: findSummary(lines),
    failedStep: findFailedStep(lines),
    locator: findLocator(combined),
    exception: findException(lines),
    stackHint: findStackHint(lines),
    rawTail
  };
}

function findSummary(lines: string[]): string {
  return lines.find(line => /failed|error|exception|element not found/i.test(line)) ?? 'Test command failed.';
}

function findFailedStep(lines: string[]): string | undefined {
  return lines.find(line => /[✽?]\./.test(line))
    ?? lines.find(line => /at .*\.feature:\d+\)?$/.test(line))
    ?? lines.find(line => /^(Given|When|Then|And|But)\b/.test(line) && /#/.test(line))
    ?? lines.find(line => /Step failed|failed step/i.test(line));
}

function findLocator(text: string): string | undefined {
  for (const pattern of locatorPatterns) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

function findException(lines: string[]): string | undefined {
  return lines.find(line => /(?:Exception|Error):/.test(line));
}

function findStackHint(lines: string[]): string | undefined {
  return lines.find(line =>
    /\.java:\d+/.test(line)
    && !/com\.codeborne|org\.openqa|io\.cucumber|org\.testng|org\.apache\.maven|java\.base|jdk\./.test(line)
  ) ?? lines.find(line => /\.java:\d+/.test(line));
}
