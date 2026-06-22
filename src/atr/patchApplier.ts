import { promises as fs } from 'fs';
import path from 'path';
import { AtrCliOptions, HealCandidate } from './types';

export interface ApplyResult {
  applied: boolean;
  reason?: string;
}

const allowedPrefixes = [
  'src/test/',
  'src\\test\\'
];

export async function applyCandidate(options: AtrCliOptions, candidate: HealCandidate): Promise<ApplyResult> {
  if (options.approvalMode !== 'auto-test-files') {
    return {
      applied: false,
      reason: 'Approval mode is report, so ATR recorded the candidate without changing files.'
    };
  }

  if (candidate.changedFiles.length === 0) {
    return {
      applied: false,
      reason: 'AI did not return any changedFiles entries.'
    };
  }

  for (const change of candidate.changedFiles) {
    const normalized = change.path.replace(/\//g, path.sep).replace(/\\/g, path.sep);
    if (!isAllowedTestAutomationPath(normalized)) {
      return {
        applied: false,
        reason: `Refused to edit non-test path: ${change.path}`
      };
    }

    const absolute = path.resolve(options.workspaceRoot, normalized);
    if (!absolute.startsWith(path.resolve(options.workspaceRoot))) {
      return {
        applied: false,
        reason: `Refused to edit path outside workspace: ${change.path}`
      };
    }

    const current = await fs.readFile(absolute, 'utf8');
    if (!current.includes(change.oldText)) {
      return {
        applied: false,
        reason: `Could not find exact oldText in ${change.path}`
      };
    }

    const next = current.replace(change.oldText, change.newText);
    await fs.writeFile(absolute, next, 'utf8');
  }

  return {
    applied: true
  };
}

function isAllowedTestAutomationPath(filePath: string): boolean {
  return allowedPrefixes.some(prefix => filePath.startsWith(prefix));
}

