import { promises as fs } from 'fs';
import path from 'path';
import { AtrCliOptions, FailureContext, SourceContext } from './types';

const ignoredDirectories = new Set([
  'node_modules',
  'target',
  'build',
  'dist',
  'out',
  '.git'
]);

export async function enrichFailureSourceContext(
  options: AtrCliOptions,
  failure: FailureContext
): Promise<FailureContext> {
  if (!failure.stackHint) {
    return failure;
  }

  const stackFrame = parseStackFrame(failure.stackHint);
  if (!stackFrame) {
    return failure;
  }

  const file = await findFile(options.workspaceRoot, stackFrame.fileName);
  if (!file) {
    return failure;
  }

  const content = await fs.readFile(file, 'utf8');
  const method = extractMethodContext(content, stackFrame.line, stackFrame.methodName);

  return {
    ...failure,
    sourceContext: {
      file: normalizeRelative(options.workspaceRoot, file),
      line: stackFrame.line,
      methodName: stackFrame.methodName,
      content: method ?? extractLineWindow(content, stackFrame.line)
    }
  };
}

function parseStackFrame(stackHint: string): { fileName: string; line: number; methodName?: string } | undefined {
  const location = /\(([^():]+\.java):(\d+)\)/.exec(stackHint) ?? /([^():\s]+\.java):(\d+)/.exec(stackHint);
  if (!location) {
    return undefined;
  }

  const methodMatch = /at\s+[\w.$]+\.([A-Za-z_$][\w$]*)\([^)]*\.java:\d+\)/.exec(stackHint);

  return {
    fileName: location[1],
    line: Number(location[2]),
    methodName: methodMatch?.[1]
  };
}

async function findFile(root: string, fileName: string): Promise<string | undefined> {
  const matches: string[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          await walk(absolute);
        }
        continue;
      }

      if (entry.isFile() && entry.name === fileName) {
        matches.push(absolute);
      }
    }
  }

  await walk(root);

  return matches.find(file => normalizePath(file).includes('/src/test/'))
    ?? matches.find(file => normalizePath(file).includes('/src/'))
    ?? matches[0];
}

function extractMethodContext(content: string, lineNumber: number, methodName?: string): string | undefined {
  const lines = content.split(/\r?\n/);
  const lineIndex = Math.max(0, Math.min(lines.length - 1, lineNumber - 1));
  const start = findMethodStart(lines, lineIndex, methodName);
  if (start === undefined) {
    return undefined;
  }

  const end = findBlockEnd(lines, start);
  const annotationStart = findAnnotationStart(lines, start);
  return lines.slice(annotationStart, end + 1).join('\n').trim();
}

function findMethodStart(lines: string[], lineIndex: number, methodName?: string): number | undefined {
  const signaturePattern = methodName
    ? new RegExp(`\\b${escapeRegex(methodName)}\\s*\\(`)
    : /\b(public|protected|private)\b.*\(/;

  for (let index = lineIndex; index >= 0; index--) {
    const line = lines[index];
    if (!signaturePattern.test(line)) {
      continue;
    }

    if (line.includes('{') || lines.slice(index, Math.min(lines.length, index + 6)).some(next => next.includes('{'))) {
      return index;
    }
  }

  return undefined;
}

function findBlockEnd(lines: string[], start: number): number {
  let depth = 0;
  let sawOpeningBrace = false;

  for (let index = start; index < lines.length; index++) {
    const line = stripStringLiterals(lines[index]);
    for (const character of line) {
      if (character === '{') {
        sawOpeningBrace = true;
        depth++;
      } else if (character === '}') {
        depth--;
        if (sawOpeningBrace && depth === 0) {
          return index;
        }
      }
    }
  }

  return Math.min(lines.length - 1, start + 30);
}

function findAnnotationStart(lines: string[], methodStart: number): number {
  let start = methodStart;
  for (let index = methodStart - 1; index >= 0; index--) {
    if (/^\s*@/.test(lines[index])) {
      start = index;
      continue;
    }

    if (lines[index].trim() === '') {
      continue;
    }

    break;
  }

  return start;
}

function extractLineWindow(content: string, lineNumber: number): string {
  const lines = content.split(/\r?\n/);
  const start = Math.max(0, lineNumber - 8);
  const end = Math.min(lines.length, lineNumber + 7);
  return lines.slice(start, end).join('\n').trim();
}

function stripStringLiterals(value: string): string {
  return value.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
}

function normalizeRelative(root: string, file: string): string {
  return normalizePath(path.relative(root, file));
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
