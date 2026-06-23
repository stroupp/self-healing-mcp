import { promises as fs } from 'fs';
import path from 'path';
import { AtrCliOptions } from './types';

export async function readHtmlSnippet(options: AtrCliOptions): Promise<string | undefined> {
  if (!options.htmlFile) {
    return undefined;
  }

  const absolute = path.isAbsolute(options.htmlFile)
    ? options.htmlFile
    : path.join(options.workspaceRoot, options.htmlFile);

  const html = await fs.readFile(absolute, 'utf8');
  return compactHtmlForHealing(html);
}

function compactHtmlForHealing(html: string): string {
  const normalized = html.replace(/\s+/g, ' ').trim();
  const windows = [
    normalized.slice(0, 1200),
    ...contextWindows(normalized, /data-test-id=["'][^"']+["']/g, 450),
    ...contextWindows(normalized, /aria-label=["'][^"']+["']/g, 250)
  ];

  return dedupeWindows(windows).join('\n...\n').slice(0, 9000);
}

function contextWindows(value: string, pattern: RegExp, radius: number): string[] {
  const windows: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    windows.push(value.slice(
      Math.max(0, match.index - radius),
      Math.min(value.length, match.index + match[0].length + radius)
    ));
  }

  return windows;
}

function dedupeWindows(windows: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const window of windows) {
    const compact = window.trim();
    if (!compact || seen.has(compact)) {
      continue;
    }

    seen.add(compact);
    output.push(compact);
  }

  return output;
}
