import { promises as fs } from 'fs';
import path from 'path';
import ts from 'typescript';

export interface ComponentGraphOptions {
  workspaceRoot: string;
  entryFile: string;
  maxDepth?: number;
  maxFiles?: number;
}

export interface ComponentGraph {
  entryFile: string;
  reachableFiles: string[];
  externalImportsSkipped: string[];
  unresolvedImports: Array<{
    from: string;
    importPath: string;
  }>;
}

const sourceExtensions = ['.tsx', '.jsx', '.ts', '.js'];

export async function collectComponentGraph(options: ComponentGraphOptions): Promise<ComponentGraph> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const entryAbsolute = path.resolve(workspaceRoot, options.entryFile);
  const maxDepth = options.maxDepth ?? 20;
  const maxFiles = options.maxFiles ?? 200;
  const visited = new Set<string>();
  const reachableFiles: string[] = [];
  const externalImportsSkipped = new Set<string>();
  const unresolvedImports: ComponentGraph['unresolvedImports'] = [];

  async function visit(file: string, depth: number): Promise<void> {
    const normalized = path.resolve(file);
    if (visited.has(normalized) || depth > maxDepth || reachableFiles.length >= maxFiles) {
      return;
    }

    visited.add(normalized);

    if (!normalized.startsWith(workspaceRoot)) {
      return;
    }

    if (!(await isFile(normalized))) {
      unresolvedImports.push({
        from: normalizeRelative(workspaceRoot, path.dirname(normalized)),
        importPath: normalizeRelative(workspaceRoot, normalized)
      });
      return;
    }

    reachableFiles.push(normalizeRelative(workspaceRoot, normalized));
    const content = await fs.readFile(normalized, 'utf8');
    const imports = readImportSpecifiers(normalized, content);

    for (const importPath of imports) {
      if (!isLocalImport(importPath)) {
        externalImportsSkipped.add(importPath);
        continue;
      }

      const resolved = await resolveLocalImport(path.dirname(normalized), importPath);
      if (!resolved) {
        unresolvedImports.push({
          from: normalizeRelative(workspaceRoot, normalized),
          importPath
        });
        continue;
      }

      await visit(resolved, depth + 1);
    }
  }

  await visit(entryAbsolute, 0);

  return {
    entryFile: normalizeRelative(workspaceRoot, entryAbsolute),
    reachableFiles,
    externalImportsSkipped: Array.from(externalImportsSkipped).sort(),
    unresolvedImports
  };
}

function readImportSpecifiers(fileName: string, content: string): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') || fileName.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const imports: string[] = [];

  sourceFile.forEachChild(node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
  });

  return imports;
}

function isLocalImport(importPath: string): boolean {
  return importPath.startsWith('./') || importPath.startsWith('../');
}

async function resolveLocalImport(directory: string, importPath: string): Promise<string | undefined> {
  const base = path.resolve(directory, importPath);
  const candidates = [
    base,
    ...sourceExtensions.map(extension => `${base}${extension}`),
    ...sourceExtensions.map(extension => path.join(base, `index${extension}`))
  ];

  for (const candidate of candidates) {
    if (await isFile(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function isFile(file: string): Promise<boolean> {
  try {
    const stat = await fs.stat(file);
    return stat.isFile();
  } catch {
    return false;
  }
}

function normalizeRelative(root: string, file: string): string {
  return path.relative(root, file).replace(/\\/g, '/');
}
