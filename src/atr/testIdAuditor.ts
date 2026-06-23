import { promises as fs } from 'fs';
import path from 'path';
import ts from 'typescript';
import { collectComponentGraph, ComponentGraph } from './componentGraph';
import { AtrKnowledge, ComponentRule } from './knowledgeTypes';

export interface TestIdAuditOptions {
  workspaceRoot: string;
  pageName?: string;
  projectPrefix?: string;
  include?: string[];
  entryFile?: string;
  followImports?: boolean;
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
  componentGraph?: ComponentGraph;
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
  const componentGraph = options.entryFile && options.followImports
    ? await collectComponentGraph({
        workspaceRoot,
        entryFile: options.entryFile,
        maxFiles: options.maxFiles
      })
    : undefined;
  const graphFiles = componentGraph?.reachableFiles;
  const files = await findReactFiles(workspaceRoot, graphFiles ?? options.include);
  const scannedFiles = files.slice(0, options.maxFiles ?? 200);
  const existing: ExistingTestId[] = [];
  const proposals: TestIdProposal[] = [];
  const warnings: string[] = [];
  const counters = new Map<string, number>();
  const fileContents: Array<{ file: string; relative: string; content: string }> = [];

  if (files.length > scannedFiles.length) {
    warnings.push(`Scan limited to ${scannedFiles.length} files out of ${files.length}.`);
  }

  if (componentGraph && componentGraph.unresolvedImports.length > 0) {
    warnings.push(`${componentGraph.unresolvedImports.length} local imports could not be resolved.`);
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
    warnings,
    componentGraph
  };
}

function collectExistingIds(file: string, content: string): ExistingTestId[] {
  return readJsxElements(file, content)
    .filter(element => element.testId)
    .map(element => ({
      file,
      line: element.line,
      component: element.component,
      testId: element.testId ?? ''
    }));
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
  const elements = readJsxElements(input.relative, input.content);

  for (const element of elements) {
    if (element.testId) {
      continue;
    }

    const elementType = resolveElementType(element.component, input.knowledge);
    if (!elementType) {
      continue;
    }

    const name = inferElementName(element, input.counters);
    const baseId = `${input.projectPrefix}-${input.pagePrefix}-${elementType}-${name}`;
    const proposedId = uniqueTestId(baseId, input.usedIds);
    input.usedIds.add(proposedId);

    proposals.push({
      file: input.relative,
      line: element.line,
      component: element.component,
      elementType,
      proposedId,
      reason: proposalReason(element.component, nameSource(element), baseId, proposedId),
      snippet: element.snippet
    });
  }

  return proposals;
}

interface JsxElementInfo {
  component: string;
  line: number;
  testId?: string;
  props: Record<string, string>;
  text: string;
  snippet: string;
}

function readJsxElements(fileName: string, content: string): JsxElementInfo[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') || fileName.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const elements: JsxElementInfo[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxSelfClosingElement(node)) {
      elements.push(readOpeningElement(sourceFile, content, node.tagName, node.attributes, node));
    } else if (ts.isJsxElement(node)) {
      elements.push(readOpeningElement(
        sourceFile,
        content,
        node.openingElement.tagName,
        node.openingElement.attributes,
        node,
        readJsxText(node)
      ));
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return elements;
}

function readOpeningElement(
  sourceFile: ts.SourceFile,
  content: string,
  tagName: ts.JsxTagNameExpression,
  attributes: ts.JsxAttributes,
  node: ts.Node,
  text = ''
): JsxElementInfo {
  const props: Record<string, string> = {};
  let testId: string | undefined;

  for (const property of attributes.properties) {
    if (!ts.isJsxAttribute(property)) {
      continue;
    }

    const name = jsxAttributeName(property.name);
    const value = readJsxAttributeValue(property);
    if (value) {
      props[name] = value;
    }

    if (name === 'data-test-id') {
      testId = value;
    }
  }

  const start = node.getStart(sourceFile);
  const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;

  return {
    component: normalizeComponentName(tagName.getText(sourceFile)),
    line,
    testId,
    props,
    text,
    snippet: compactSnippet(content.slice(start, node.getEnd()))
  };
}

function jsxAttributeName(name: ts.JsxAttributeName): string {
  return ts.isIdentifier(name) ? name.text : name.getText();
}

function readJsxAttributeValue(attribute: ts.JsxAttribute): string | undefined {
  const initializer = attribute.initializer;
  if (!initializer) {
    return undefined;
  }

  if (ts.isStringLiteral(initializer)) {
    return initializer.text;
  }

  if (ts.isJsxExpression(initializer) && initializer.expression) {
    const expression = initializer.expression;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return expression.text;
    }

    return expression.getText();
  }

  return undefined;
}

function readJsxText(element: ts.JsxElement): string {
  return element.children
    .filter(ts.isJsxText)
    .map(child => child.getText().replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
}

function normalizeComponentName(value: string): string {
  return value.split('.').pop() ?? value;
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
  element: JsxElementInfo,
  counters: Map<string, number>
): string {
  const propValue =
    element.props.label ??
    element.props.placeholder ??
    element.props.title ??
    element.props.name ??
    element.props.id ??
    visibleText(element.text) ??
    handlerAction(element.props.onClick);

  if (propValue) {
    return toKebabCase(propValue);
  }

  const key = element.component.toLowerCase();
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  return `${toKebabCase(element.component)}-${next}`;
}

function visibleText(text: string): string | undefined {
  const normalized = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]+\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.length >= 2 ? normalized : undefined;
}

function handlerAction(handler?: string): string | undefined {
  if (!handler) {
    return undefined;
  }

  return handler
    .replace(/^handle/i, '')
    .replace(/Click$/i, '')
    .replace(/Submit$/i, 'submit');
}

function nameSource(element: JsxElementInfo): string {
  if (element.props.label) return 'label';
  if (element.props.placeholder) return 'placeholder';
  if (element.props.title) return 'title';
  if (element.props.name) return 'name';
  if (element.props.id) return 'id';
  if (visibleText(element.text)) return 'visible text';
  if (handlerAction(element.props.onClick)) return 'handler';
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
