import { promises as fs } from 'fs';
import path from 'path';
import { AtrKnowledge, ComponentRule } from './knowledgeTypes';

export interface TestIdAuditOptions {
  workspaceRoot: string;
  pageName?: string;
  projectPrefix?: string;
  include?: string[];
  maxFiles?: number;
}

export interface TestIdProposal {
  file: string;
  line: number;
  component: string;
  elementType: string;
  proposedId: string;
  reason: string;
  snippet: string;
}

export interface ExistingTestId {
  file: string;
  line: number;
  component: string;
  testId: string;
}

export interface DuplicateTestId {
  testId: string;
  occurrences: ExistingTestId[];
}

export interface TestIdAuditReport {
  workspaceRoot: string;
  pageName?: string;
  projectPrefix: string;
  scannedFiles: string[];
  existing: ExistingTestId[];
  duplicates: DuplicateTestId[];
  proposals: TestIdProposal[];
  warnings: string[];
}

const ignoredDirectories = new Set([
  '.git',
  '.idea',
  '.vscode',
  'node_modules',
  'out',
  'target',
  'build',
  'dist'
]);

const nativeElementTypes: Record<string, string> = {
  button: 'btn',
  input: 'input',
  select: 'select',
  textarea: 'textarea',
  form: 'form',
  table: 'table'
};

export async function auditTestIds(
  options: TestIdAuditOptions,
  knowledge: AtrKnowledge
): Promise<TestIdAuditReport> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const projectPrefix = toKebabCase(options.projectPrefix ?? options.pageName ?? path.basename(workspaceRoot));
  const files = await findReactFiles(workspaceRoot, options.include);
  const scannedFiles = files.slice(0, options.maxFiles ?? 200);
  const existing: ExistingTestId[] = [];
  const proposals: TestIdProposal[] = [];
  const warnings: string[] = [];
  const counters = new Map<string, number>();
  const fileContents: Array<{ file: string; relative: string; content: string }> = [];

  if (files.length > scannedFiles.length) {
    warnings.push(`Scan limited to ${scannedFiles.length} files out of ${files.length}.`);
  }

  for (const file of scannedFiles) {
    const content = await fs.readFile(file, 'utf8');
    const relative = normalizeRelative(workspaceRoot, file);
    fileContents.push({ file, relative, content });
    const fileExisting = collectExistingIds(relative, content);
    existing.push(...fileExisting);
  }

  const duplicates = findDuplicateTestIds(existing);
  const usedIds = new Set(existing.map(item => item.testId));

  for (const fileContent of fileContents) {
    const pageName = options.pageName ?? inferPageName(fileContent.relative);
    const pagePrefix = toKebabCase(pageName);
    proposals.push(...collectMissingIds({
      relative: fileContent.relative,
      content: fileContent.content,
      pagePrefix,
      projectPrefix,
      knowledge,
      usedIds,
      counters
    }));
  }

  return {
    workspaceRoot,
    pageName: options.pageName,
    projectPrefix,
    scannedFiles: scannedFiles.map(file => normalizeRelative(workspaceRoot, file)),
    existing,
    duplicates,
    proposals,
    warnings
  };
}

function collectExistingIds(file: string, content: string): ExistingTestId[] {
  const existing: ExistingTestId[] = [];
  const regex = /<([A-Za-z][A-Za-z0-9.]*)\b[^>]*data-test-id\s*=\s*["']([^"']+)["'][^>]*>/gs;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    existing.push({
      file,
      line: lineNumber(content, match.index),
      component: match[1],
      testId: match[2]
    });
  }

  return existing;
}

function collectMissingIds(input: {
  relative: string;
  content: string;
  pagePrefix: string;
  projectPrefix: string;
  knowledge: AtrKnowledge;
  usedIds: Set<string>;
  counters: Map<string, number>;
}): TestIdProposal[] {
  const proposals: TestIdProposal[] = [];
  const regex = /<([A-Za-z][A-Za-z0-9.]*)\b([^<>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input.content)) !== null) {
    const component = match[1].split('.').pop() ?? match[1];
    const attributes = match[2] ?? '';
    const inner = match[3] ?? '';
    const full = match[0];

    if (/\bdata-test-id\s*=/.test(full)) {
      continue;
    }

    const elementType = resolveElementType(component, input.knowledge);
    if (!elementType) {
      continue;
    }

    const name = inferElementName(attributes, inner, component, input.counters);
    const baseId = `${input.projectPrefix}-${input.pagePrefix}-${elementType}-${name}`;
    const proposedId = uniqueTestId(baseId, input.usedIds);
    input.usedIds.add(proposedId);

    proposals.push({
      file: input.relative,
      line: lineNumber(input.content, match.index),
      component,
      elementType,
      proposedId,
      reason: proposalReason(component, nameSource(attributes, inner), baseId, proposedId),
      snippet: compactSnippet(full)
    });
  }

  return proposals;
}

function findDuplicateTestIds(existing: ExistingTestId[]): DuplicateTestId[] {
  const grouped = new Map<string, ExistingTestId[]>();

  for (const item of existing) {
    grouped.set(item.testId, [...(grouped.get(item.testId) ?? []), item]);
  }

  return Array.from(grouped.entries())
    .filter(([, occurrences]) => occurrences.length > 1)
    .map(([testId, occurrences]) => ({
      testId,
      occurrences
    }));
}

function uniqueTestId(baseId: string, usedIds: Set<string>): string {
  if (!usedIds.has(baseId)) {
    return baseId;
  }

  for (let index = 2; index < 1000; index++) {
    const candidate = `${baseId}-${index}`;
    if (!usedIds.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not create a unique data-test-id for ${baseId}`);
}

function proposalReason(component: string, source: string, baseId: string, proposedId: string): string {
  const base = `Missing data-test-id on ${component}; inferred name from ${source}`;
  return baseId === proposedId
    ? base
    : `${base}; adjusted to avoid duplicate id ${baseId}`;
}

function resolveElementType(component: string, knowledge: AtrKnowledge): string | undefined {
  const native = nativeElementTypes[component.toLowerCase()];
  if (native) {
    return native;
  }

  const rule = knowledge.componentRules.find((componentRule: ComponentRule) =>
    componentRule.componentNames.includes(component)
  );

  return rule?.typeKey;
}

function inferElementName(
  attributes: string,
  inner: string,
  component: string,
  counters: Map<string, number>
): string {
  const propValue =
    readAttribute(attributes, 'label') ??
    readAttribute(attributes, 'placeholder') ??
    readAttribute(attributes, 'title') ??
    readAttribute(attributes, 'name') ??
    readAttribute(attributes, 'id') ??
    visibleText(inner) ??
    handlerAction(attributes);

  if (propValue) {
    return toKebabCase(propValue);
  }

  const key = component.toLowerCase();
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  return `${toKebabCase(component)}-${next}`;
}

function readAttribute(attributes: string, name: string): string | undefined {
  const quoted = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`).exec(attributes);
  if (quoted?.[1]) {
    return quoted[1];
  }

  const bracedString = new RegExp(`${name}\\s*=\\s*\\{\\s*["']([^"']+)["']\\s*\\}`).exec(attributes);
  return bracedString?.[1];
}

function visibleText(inner: string): string | undefined {
  const withoutTags = inner
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]+\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return withoutTags.length >= 2 ? withoutTags : undefined;
}

function handlerAction(attributes: string): string | undefined {
  const handler = /onClick\s*=\s*\{?\s*([A-Za-z0-9_.$]+)/.exec(attributes)?.[1];
  if (!handler) {
    return undefined;
  }

  return handler
    .replace(/^handle/i, '')
    .replace(/Click$/i, '')
    .replace(/Submit$/i, 'submit');
}

function nameSource(attributes: string, inner: string): string {
  if (readAttribute(attributes, 'label')) return 'label';
  if (readAttribute(attributes, 'placeholder')) return 'placeholder';
  if (readAttribute(attributes, 'title')) return 'title';
  if (readAttribute(attributes, 'name')) return 'name';
  if (readAttribute(attributes, 'id')) return 'id';
  if (visibleText(inner)) return 'visible text';
  if (handlerAction(attributes)) return 'handler';
  return 'fallback counter';
}

async function findReactFiles(workspaceRoot: string, include?: string[]): Promise<string[]> {
  if (include && include.length > 0) {
    return include.map(item => path.resolve(workspaceRoot, item));
  }

  const results: string[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
        continue;
      }

      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile() && /\.(tsx|jsx)$/i.test(entry.name)) {
        results.push(absolute);
      }
    }
  }

  await walk(workspaceRoot);
  return results;
}

function inferPageName(relativePath: string): string {
  const base = path.basename(relativePath, path.extname(relativePath));
  return base.toLowerCase() === 'index'
    ? path.basename(path.dirname(relativePath))
    : base;
}

function lineNumber(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

function compactSnippet(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function normalizeRelative(root: string, file: string): string {
  return path.relative(root, file).replace(/\\/g, '/');
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .toLowerCase() || 'item';
}
