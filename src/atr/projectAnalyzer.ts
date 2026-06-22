import { promises as fs } from 'fs';
import path from 'path';
import { AtrKnowledge } from './knowledgeTypes';

export interface ProjectAnalysis {
  workspaceRoot: string;
  exists: boolean;
  packageManagers: string[];
  suggestedTestCommand?: string;
  sourceFiles: {
    react: string[];
    pageObjects: string[];
    componentObjects: string[];
    stepDefinitions: string[];
    features: string[];
    sharedInfrastructure: string[];
  };
  counts: {
    dataTestIds: number;
    selenideLocators: number;
    shadowCssLocators: number;
    cssLocators: number;
    dollarLocators: number;
  };
  conventions: {
    hasMaven: boolean;
    hasCucumber: boolean;
    hasSelenide: boolean;
    hasReactSources: boolean;
    hasKnowledgeFile: boolean;
    protectedFilesPresent: string[];
  };
  recommendations: string[];
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

export async function analyzeProject(workspaceRoot: string, knowledge: AtrKnowledge): Promise<ProjectAnalysis> {
  const root = path.resolve(workspaceRoot);
  const exists = await pathExists(root);

  if (!exists) {
    return emptyAnalysis(root);
  }

  const files = await listFiles(root);
  const relativeFiles = files.map(file => normalizeRelative(root, file));
  const readTextFiles = await readRelevantText(files);

  const pageObjects = relativeFiles.filter(file => /src\/.*Page\.java$/i.test(file));
  const componentObjects = relativeFiles.filter(file => /src\/.*Component\.java$/i.test(file));
  const stepDefinitions = relativeFiles.filter(file => /src\/.*Steps\.java$/i.test(file));
  const features = relativeFiles.filter(file => /src\/.*\.feature$/i.test(file));
  const react = relativeFiles.filter(file => /src\/.*\.(tsx|jsx|ts|js)$/i.test(file) && !/src\/test\//i.test(file));
  const sharedInfrastructure = relativeFiles.filter(file =>
    knowledge.protectedFiles.some(protectedFile => file.endsWith(`/${protectedFile}`))
  );

  const allText = readTextFiles.map(item => item.content).join('\n');
  const shadowCssLocators = countMatches(allText, /shadowCss\s*\(/g);
  const cssLocators = countMatches(allText, /\bcss\s*\(/g);
  const dollarLocators = countMatches(allText, /\$\s*\(/g);
  const dataTestIds = countMatches(allText, /data-test-id\s*=/g);
  const packageManagers = detectPackageManagers(relativeFiles);

  const analysis: ProjectAnalysis = {
    workspaceRoot: root,
    exists: true,
    packageManagers,
    suggestedTestCommand: suggestTestCommand(relativeFiles),
    sourceFiles: {
      react,
      pageObjects,
      componentObjects,
      stepDefinitions,
      features,
      sharedInfrastructure
    },
    counts: {
      dataTestIds,
      selenideLocators: shadowCssLocators + cssLocators + dollarLocators,
      shadowCssLocators,
      cssLocators,
      dollarLocators
    },
    conventions: {
      hasMaven: relativeFiles.some(file => file.endsWith('pom.xml')),
      hasCucumber: features.length > 0 || stepDefinitions.length > 0,
      hasSelenide: /com\.codeborne\.selenide|SelenideElement|ElementsCollection/.test(allText),
      hasReactSources: react.length > 0,
      hasKnowledgeFile: Boolean(knowledge.sourcePath),
      protectedFilesPresent: sharedInfrastructure
    },
    recommendations: []
  };

  analysis.recommendations = buildRecommendations(analysis);
  return analysis;
}

function emptyAnalysis(workspaceRoot: string): ProjectAnalysis {
  return {
    workspaceRoot,
    exists: false,
    packageManagers: [],
    sourceFiles: {
      react: [],
      pageObjects: [],
      componentObjects: [],
      stepDefinitions: [],
      features: [],
      sharedInfrastructure: []
    },
    counts: {
      dataTestIds: 0,
      selenideLocators: 0,
      shadowCssLocators: 0,
      cssLocators: 0,
      dollarLocators: 0
    },
    conventions: {
      hasMaven: false,
      hasCucumber: false,
      hasSelenide: false,
      hasReactSources: false,
      hasKnowledgeFile: false,
      protectedFilesPresent: []
    },
    recommendations: ['Workspace path does not exist.']
  };
}

async function listFiles(root: string): Promise<string[]> {
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
      } else if (entry.isFile()) {
        results.push(absolute);
      }
    }
  }

  await walk(root);
  return results;
}

async function readRelevantText(files: string[]): Promise<Array<{ file: string; content: string }>> {
  const relevant = files.filter(file => /\.(java|feature|tsx|jsx|ts|js|xml|json|md)$/i.test(file));
  const reads = relevant.map(async file => {
    try {
      return {
        file,
        content: await fs.readFile(file, 'utf8')
      };
    } catch {
      return {
        file,
        content: ''
      };
    }
  });

  return Promise.all(reads);
}

function normalizeRelative(root: string, file: string): string {
  return path.relative(root, file).replace(/\\/g, '/');
}

function countMatches(value: string, regex: RegExp): number {
  return Array.from(value.matchAll(regex)).length;
}

function detectPackageManagers(files: string[]): string[] {
  const managers: string[] = [];
  if (files.includes('pom.xml')) managers.push('maven');
  if (files.includes('package.json')) managers.push('npm');
  if (files.includes('yarn.lock')) managers.push('yarn');
  if (files.includes('pnpm-lock.yaml')) managers.push('pnpm');
  return managers;
}

function suggestTestCommand(files: string[]): string | undefined {
  if (files.includes('mvnw.cmd')) {
    return '.\\mvnw.cmd test';
  }

  if (files.includes('mvnw')) {
    return './mvnw test';
  }

  if (files.includes('pom.xml')) {
    return 'mvn test';
  }

  if (files.includes('package.json')) {
    return 'npm test';
  }

  return undefined;
}

function buildRecommendations(analysis: ProjectAnalysis): string[] {
  const recommendations: string[] = [];

  if (!analysis.conventions.hasKnowledgeFile) {
    recommendations.push('Add docs/knowledge.md or pass a knowledgeFile path so ATR can apply project conventions.');
  }

  if (analysis.sourceFiles.features.length === 0) {
    recommendations.push('No Cucumber feature files were detected under src/**.');
  }

  if (analysis.sourceFiles.pageObjects.length === 0) {
    recommendations.push('No Page Object files were detected under src/**Page.java.');
  }

  if (analysis.counts.dataTestIds === 0 && analysis.conventions.hasReactSources) {
    recommendations.push('React sources exist but no data-test-id attributes were detected.');
  }

  if (analysis.counts.shadowCssLocators === 0 && analysis.counts.selenideLocators > 0) {
    recommendations.push('Selenide locators exist, but shadowCss usage was not detected. Confirm whether the project needs shadow DOM support.');
  }

  return recommendations;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
