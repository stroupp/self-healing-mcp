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
  return html.replace(/\s+/g, ' ').trim().slice(0, 12000);
}

