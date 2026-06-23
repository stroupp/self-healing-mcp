import { promises as fs } from 'fs';
import path from 'path';
import { AtrKnowledge } from './knowledgeTypes';
import { auditTestIds, TestIdAuditOptions } from './testIdAuditor';

export interface ValidationOptions extends TestIdAuditOptions {
  featureFile?: string;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  file?: string;
  line?: number;
}

export interface ValidationReport {
  workspaceRoot: string;
  status: 'passed' | 'failed';
  issues: ValidationIssue[];
}

export async function validateArtifacts(
  options: ValidationOptions,
  knowledge: AtrKnowledge
): Promise<ValidationReport> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const issues: ValidationIssue[] = [];
  const audit = await auditTestIds(options, knowledge);

  for (const duplicate of audit.duplicates) {
    for (const occurrence of duplicate.occurrences) {
      issues.push({
        severity: 'error',
        message: `Duplicate data-test-id "${duplicate.testId}" must be unique.`,
        file: occurrence.file,
        line: occurrence.line
      });
    }
  }

  for (const proposal of audit.proposals) {
    issues.push({
      severity: 'error',
      message: `Missing data-test-id candidate: ${proposal.proposedId}`,
      file: proposal.file,
      line: proposal.line
    });
  }

  if (options.featureFile) {
    issues.push(...await validateFeatureSteps(workspaceRoot, options.featureFile));
  }

  return {
    workspaceRoot,
    status: issues.some(issue => issue.severity === 'error') ? 'failed' : 'passed',
    issues
  };
}

async function validateFeatureSteps(workspaceRoot: string, featureFile: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const featurePath = path.resolve(workspaceRoot, featureFile);
  const feature = await readIfExists(featurePath);
  if (!feature) {
    return [{
      severity: 'error',
      message: 'Feature file does not exist.',
      file: featureFile
    }];
  }

  const stepTexts = readFeatureStepTexts(feature);
  const javaAnnotations = await readStepAnnotations(workspaceRoot);

  for (const step of stepTexts) {
    if (!javaAnnotations.some(annotation => stepMatchesAnnotation(step.text, annotation.pattern))) {
      issues.push({
        severity: 'warning',
        message: `No matching Java step annotation found for: ${step.text}`,
        file: featureFile,
        line: step.line
      });
    }
  }

  return issues;
}

function readFeatureStepTexts(feature: string): Array<{ line: number; text: string }> {
  const steps: Array<{ line: number; text: string }> = [];
  const lines = feature.split(/\r?\n/);
  const stepRegex = /^\s*(Given|When|Then|And|But)\s+(.+)\s*$/;

  for (let index = 0; index < lines.length; index++) {
    const match = stepRegex.exec(lines[index]);
    if (match) {
      steps.push({
        line: index + 1,
        text: match[2].trim()
      });
    }
  }

  return steps;
}

async function readStepAnnotations(workspaceRoot: string): Promise<Array<{ file: string; pattern: string }>> {
  const javaFiles = await listFiles(workspaceRoot, file => /src\/.*Steps\.java$/i.test(file.replace(/\\/g, '/')));
  const annotations: Array<{ file: string; pattern: string }> = [];
  const annotationRegex = /@(Given|When|Then|And|But)\("([^"]+)"\)/g;

  for (const file of javaFiles) {
    const content = await fs.readFile(file, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = annotationRegex.exec(content)) !== null) {
      annotations.push({
        file: path.relative(workspaceRoot, file).replace(/\\/g, '/'),
        pattern: match[2]
      });
    }
  }

  return annotations;
}

function stepMatchesAnnotation(stepText: string, annotationPattern: string): boolean {
  const regexText = annotationPattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{int\\\}/g, '\\d+')
    .replace(/\\\{string\\\}/g, '"[^"]+"')
    .replace(/\\\{double\\\}/g, '\\d+(?:\\.\\d+)?');

  return new RegExp(`^${regexText}$`).test(stepText);
}

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    return undefined;
  }
}

async function listFiles(root: string, predicate: (file: string) => boolean): Promise<string[]> {
  const ignored = new Set(['.git', '.idea', '.vscode', 'node_modules', 'out', 'target', 'build', 'dist']);
  const results: string[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && ignored.has(entry.name)) {
        continue;
      }

      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile() && predicate(absolute)) {
        results.push(absolute);
      }
    }
  }

  await walk(root);
  return results;
}
