import { promises as fs } from 'fs';
import path from 'path';
import { AtrCliOptions, FailureContext, HealCandidate } from './types';

export async function suggestLocalLocatorHeal(
  options: AtrCliOptions,
  failure: FailureContext,
  htmlSnippet: string | undefined
): Promise<HealCandidate | undefined> {
  const brokenTestId = extractDataTestId(failure.locator ?? failure.rawTail);
  if (!brokenTestId || !htmlSnippet) {
    return undefined;
  }

  const replacementTestId = findBestDataTestId(brokenTestId, htmlSnippet);
  if (!replacementTestId) {
    return undefined;
  }

  const oldSelector = `[data-test-id='${brokenTestId}']`;
  const newSelector = `[data-test-id='${replacementTestId}']`;
  const target = await findFileContaining(options.workspaceRoot, 'src/test', oldSelector);

  if (!target) {
    return undefined;
  }

  return {
    status: 'locator_fix',
    confidence: 'medium',
    reasoning: [
      'AI backend was unavailable, so ATR used local data-test-id matching.',
      `Broken selector uses data-test-id "${brokenTestId}".`,
      `The failed page HTML contains a similar candidate "${replacementTestId}".`
    ].join(' '),
    changedFiles: [
      {
        path: target,
        oldText: oldSelector,
        newText: newSelector,
        reason: `Replace missing data-test-id "${brokenTestId}" with "${replacementTestId}" from failed page HTML.`
      }
    ],
    suggestedCommands: [
      options.testCommand
    ]
  };
}

function extractDataTestId(value: string): string | undefined {
  return /data-test-id=['"]?([a-zA-Z0-9._:-]+)['"]?/.exec(value)?.[1];
}

function findBestDataTestId(broken: string, html: string): string | undefined {
  const ids = [...html.matchAll(/data-test-id=["']([^"']+)["']/g)].map(match => match[1]);
  const brokenTokens = tokenize(broken).filter(token => token !== 'wrong' && token !== 'old' && token !== 'broken');

  let best: { id: string; score: number } | undefined;
  for (const id of ids) {
    const candidateTokens = tokenize(id);
    const overlap = brokenTokens.filter(token => candidateTokens.includes(token)).length;
    const suffixBonus = brokenTokens.at(-1) && candidateTokens.at(-1) === brokenTokens.at(-1) ? 1 : 0;
    const score = overlap * 10 + suffixBonus;

    if (score > (best?.score ?? 0)) {
      best = { id, score };
    }
  }

  return best && best.score >= 10 ? best.id : undefined;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

async function findFileContaining(root: string, relativeDir: string, needle: string): Promise<string | undefined> {
  const base = path.join(root, relativeDir);
  const files = await listFiles(base);

  for (const file of files) {
    if (!/\.(java|feature|ts|tsx|js|jsx)$/.test(file)) {
      continue;
    }

    const content = await fs.readFile(file, 'utf8');
    if (content.includes(needle)) {
      return path.relative(root, file);
    }
  }

  return undefined;
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listFiles(entryPath));
    } else {
      results.push(entryPath);
    }
  }

  return results;
}

