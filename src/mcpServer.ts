#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import path from 'path';
import { validateArtifacts } from './atr/artifactValidator';
import { loadAtrKnowledge, summarizeKnowledge } from './atr/knowledgeBase';
import { analyzeProject } from './atr/projectAnalyzer';
import { selfHeal } from './atr/selfHeal';
import { auditTestIds } from './atr/testIdAuditor';
import { writeTestIdAuditReport } from './atr/testIdReportWriter';
import { AiProvider, AtrCliOptions } from './atr/types';

const selfHealSchema = {
  workspace: z.string().describe('Absolute path to the test automation project.'),
  testCommand: z.string().describe('Command that runs the Cucumber/Selenide test. Example: .\\\\mvnw.cmd test'),
  feature: z.string().optional().describe('Workspace-relative feature file path.'),
  scenario: z.string().optional().describe('Scenario name for reporting.'),
  htmlFile: z.string().default('target/failed-page.html').describe('Workspace-relative HTML dump file.'),
  approvalMode: z.enum(['report', 'auto-test-files']).default('report'),
  maxAttempts: z.number().int().positive().max(5).default(2),
  aiProvider: z.enum(['ollama', 'openai-compatible', 'dashscope']).default('openai-compatible'),
  aiProfile: z.enum(['default', 'alibaba-free']).default('alibaba-free'),
  aiModel: z.string().default('qwen3.7-plus'),
  aiEndpoint: z.string().default('https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
  aiApiKeyEnv: z.string().default('DASHSCOPE_API_KEY'),
  reportDir: z.string().default('target/atr-healer/reports'),
  aiLogDir: z.string().default('target/atr-healer/ai-logs')
};

const knowledgeSchema = {
  workspace: z.string().default(process.cwd()).describe('Absolute path to the project that owns docs/knowledge.md.'),
  knowledgeFile: z.string().optional().describe('Optional absolute or workspace-relative knowledge markdown path.')
};

const analyzeProjectSchema = {
  workspace: z.string().describe('Absolute path to the UI test automation project.'),
  knowledgeFile: z.string().optional().describe('Optional absolute or workspace-relative knowledge markdown path.')
};

const auditTestIdsSchema = {
  workspace: z.string().describe('Absolute path to the UI project.'),
  knowledgeFile: z.string().optional().describe('Optional absolute or workspace-relative knowledge markdown path.'),
  page: z.string().optional().describe('Page name used in proposed data-test-id values.'),
  projectPrefix: z.string().optional().describe('Project prefix used in proposed data-test-id values.'),
  include: z.array(z.string()).default([]).describe('Workspace-relative React files to scan. Empty scans all React files.'),
  entryFile: z.string().optional().describe('Workspace-relative page entry file. When set with followImports, ATR scans reachable local components.'),
  followImports: z.boolean().default(false),
  maxFiles: z.number().int().positive().max(500).default(200),
  reportDir: z.string().default('target/atr-healer/reports')
};

const validateArtifactsSchema = {
  workspace: z.string().describe('Absolute path to the UI project.'),
  knowledgeFile: z.string().optional().describe('Optional absolute or workspace-relative knowledge markdown path.'),
  page: z.string().optional(),
  projectPrefix: z.string().optional(),
  include: z.array(z.string()).default([]),
  entryFile: z.string().optional(),
  followImports: z.boolean().default(false),
  feature: z.string().optional().describe('Optional workspace-relative feature file to validate against Java step annotations.'),
  maxFiles: z.number().int().positive().max(500).default(200)
};

type SelfHealInput = {
  workspace: string;
  testCommand: string;
  feature?: string;
  scenario?: string;
  htmlFile: string;
  approvalMode: 'report' | 'auto-test-files';
  maxAttempts: number;
  aiProvider: AiProvider;
  aiProfile: 'default' | 'alibaba-free';
  aiModel: string;
  aiEndpoint: string;
  aiApiKeyEnv: string;
  reportDir: string;
  aiLogDir: string;
};

const server = new McpServer(
  {
    name: 'atr-healer',
    version: '0.1.0'
  },
  {
    instructions: [
      'ATR self-heals Selenide + Cucumber tests.',
      'Use atr_self_heal_scenario to run a test, parse locator failures, collect HTML context, ask the configured LLM, patch allowed test files, rerun, and write a report.',
      'Use approvalMode=report first when working on unknown projects. Use auto-test-files only when editing src/test/** is acceptable.'
    ].join(' ')
  }
);

server.registerTool(
  'atr_knowledge_summary',
  {
    title: 'ATR Knowledge Summary',
    description: 'Load docs/knowledge.md and return normalized generic ATR rules for generation and healing.',
    inputSchema: knowledgeSchema
  },
  async (input: { workspace: string; knowledgeFile?: string }): Promise<CallToolResult> => {
    const workspaceRoot = path.resolve(input.workspace);
    const knowledge = await loadAtrKnowledge({
      workspaceRoot,
      knowledgeFile: input.knowledgeFile
    });
    const summary = summarizeKnowledge(knowledge);

    return {
      content: [
        {
          type: 'text',
          text: [
            'ATR knowledge loaded.',
            `Source: ${summary.sourcePath ?? 'default rules only'}`,
            `Sections: ${summary.sections.length}`,
            `Naming: ${summary.namingPattern}`,
            `Type keys: ${summary.supportedTypeKeys.join(', ')}`,
            `Protected files: ${summary.protectedFiles.join(', ')}`
          ].join('\n')
        }
      ],
      structuredContent: toStructuredContent(summary)
    };
  }
);

server.registerTool(
  'atr_analyze_project',
  {
    title: 'ATR Analyze Project',
    description: 'Inspect a UI test automation project and report detected Cucumber, Selenide, React, locator, and data-test-id structure.',
    inputSchema: analyzeProjectSchema
  },
  async (input: { workspace: string; knowledgeFile?: string }): Promise<CallToolResult> => {
    const workspaceRoot = path.resolve(input.workspace);
    const knowledge = await loadAtrKnowledge({
      workspaceRoot,
      knowledgeFile: input.knowledgeFile
    });
    const analysis = await analyzeProject(workspaceRoot, knowledge);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Workspace: ${analysis.workspaceRoot}`,
            `Exists: ${analysis.exists}`,
            `Suggested test command: ${analysis.suggestedTestCommand ?? 'unknown'}`,
            `Features: ${analysis.sourceFiles.features.length}`,
            `Page objects: ${analysis.sourceFiles.pageObjects.length}`,
            `Step definitions: ${analysis.sourceFiles.stepDefinitions.length}`,
            `React source files: ${analysis.sourceFiles.react.length}`,
            `data-test-id count: ${analysis.counts.dataTestIds}`,
            `Selenide locator count: ${analysis.counts.selenideLocators}`,
            analysis.recommendations.length > 0
              ? `Recommendations:\n- ${analysis.recommendations.join('\n- ')}`
              : 'Recommendations: none'
          ].join('\n')
        }
      ],
      structuredContent: toStructuredContent(analysis)
    };
  }
);

if (optionalToolsEnabled()) {
  server.registerTool(
    'atr_audit_test_ids',
    {
      title: 'ATR Audit Test IDs',
      description: 'Report missing data-test-id candidates for React files. This tool does not edit files.',
      inputSchema: auditTestIdsSchema
    },
    async (input: {
      workspace: string;
      knowledgeFile?: string;
      page?: string;
      projectPrefix?: string;
      include: string[];
      entryFile?: string;
      followImports: boolean;
      maxFiles: number;
      reportDir: string;
    }): Promise<CallToolResult> => {
      const workspaceRoot = path.resolve(input.workspace);
      const knowledge = await loadAtrKnowledge({
        workspaceRoot,
        knowledgeFile: input.knowledgeFile
      });
      const report = await auditTestIds(
        {
          workspaceRoot,
          pageName: input.page,
          projectPrefix: input.projectPrefix,
          include: input.include,
          entryFile: input.entryFile,
          followImports: input.followImports,
          maxFiles: input.maxFiles
        },
        knowledge
      );
      const reportPath = await writeTestIdAuditReport(report, input.reportDir);

      return {
        content: [
          {
            type: 'text',
            text: [
              'ATR test-id audit completed.',
              `Scanned files: ${report.scannedFiles.length}`,
              `Existing test IDs: ${report.existing.length}`,
              `Duplicate test IDs: ${report.duplicates.length}`,
              `Proposals: ${report.proposals.length}`,
              `Report: ${reportPath}`
            ].join('\n')
          }
        ],
        structuredContent: toStructuredContent({
          ...report,
          reportPath
        })
      };
    }
  );

  server.registerTool(
    'atr_validate_test_artifacts',
    {
      title: 'ATR Validate Test Artifacts',
      description: 'Validate test-id audit cleanliness and optional feature-step bindings. This tool does not edit files.',
      inputSchema: validateArtifactsSchema
    },
    async (input: {
      workspace: string;
      knowledgeFile?: string;
      page?: string;
      projectPrefix?: string;
      include: string[];
      entryFile?: string;
      followImports: boolean;
      feature?: string;
      maxFiles: number;
    }): Promise<CallToolResult> => {
      const workspaceRoot = path.resolve(input.workspace);
      const knowledge = await loadAtrKnowledge({
        workspaceRoot,
        knowledgeFile: input.knowledgeFile
      });
      const report = await validateArtifacts(
        {
          workspaceRoot,
          pageName: input.page,
          projectPrefix: input.projectPrefix,
          include: input.include,
          entryFile: input.entryFile,
          followImports: input.followImports,
          featureFile: input.feature,
          maxFiles: input.maxFiles
        },
        knowledge
      );

      return {
        content: [
          {
            type: 'text',
            text: [
              `ATR validation status: ${report.status}`,
              `Issues: ${report.issues.length}`,
              ...report.issues.slice(0, 20).map(issue =>
                `${issue.severity.toUpperCase()}: ${issue.file ?? 'project'}${issue.line ? `:${issue.line}` : ''} ${issue.message}`
              )
            ].join('\n')
          }
        ],
        structuredContent: toStructuredContent(report)
      };
    }
  );
}

server.registerTool(
  'atr_self_heal_scenario',
  {
    title: 'ATR Self-Heal Scenario',
    description: 'Run a Selenide+Cucumber scenario, heal a broken locator, rerun it, and return the report path.',
    inputSchema: selfHealSchema
  },
  async (input: SelfHealInput): Promise<CallToolResult> => {
    const options = toOptions(input);
    const report = await selfHeal(options);
    const summary = [
      `ATR status: ${report.status}`,
      `Attempts: ${report.attempts.length}`,
      `Report: ${report.reportPath}`,
      '',
      ...report.attempts.map(attempt => {
        const candidate = attempt.candidate
          ? `candidate=${attempt.candidate.status}, confidence=${attempt.candidate.confidence}`
          : 'candidate=none';
        return `Attempt ${attempt.run.attempt}: exitCode=${attempt.run.exitCode}, ${candidate}`;
      })
    ].join('\n');

    return {
      content: [
        {
          type: 'text',
          text: summary
        }
      ],
      structuredContent: {
        status: report.status,
        attempts: report.attempts.length,
        reportPath: report.reportPath,
        changedFiles: report.attempts.flatMap(attempt =>
          attempt.candidate?.changedFiles.map(change => change.path) ?? []
        )
      }
    };
  }
);

function toOptions(input: SelfHealInput): AtrCliOptions {
  const defaults = input.aiProfile === 'alibaba-free'
    ? {
        maxAttempts: 2,
        maxCallsPerRun: 2,
        dailyCallLimit: 20,
        maxPromptChars: 8000,
        maxOutputTokens: 800
      }
    : {
        maxAttempts: input.maxAttempts,
        maxCallsPerRun: input.maxAttempts,
        dailyCallLimit: 50,
        maxPromptChars: 12000,
        maxOutputTokens: 1200
      };

  return {
    workspaceRoot: path.resolve(input.workspace),
    testCommand: input.testCommand,
    featureFile: input.feature,
    scenarioName: input.scenario,
    htmlFile: input.htmlFile,
    maxAttempts: Math.min(input.maxAttempts, defaults.maxAttempts),
    reportDir: input.reportDir,
    aiEndpoint: input.aiEndpoint,
    aiModel: input.aiModel,
    aiProvider: input.aiProvider,
    aiApiKeyEnv: input.aiApiKeyEnv,
    aiMaxCallsPerRun: defaults.maxCallsPerRun,
    aiDailyCallLimit: defaults.dailyCallLimit,
    aiMaxPromptChars: defaults.maxPromptChars,
    aiMaxOutputTokens: defaults.maxOutputTokens,
    aiLogDir: input.aiLogDir,
    approvalMode: input.approvalMode
  };
}

function toStructuredContent(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function optionalToolsEnabled(): boolean {
  return process.env.ATR_MCP_ENABLE_OPTIONAL_TOOLS === 'true';
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
