import { promises as fs } from 'fs';
import path from 'path';
import { TestIdAuditReport } from './testIdAuditor';

export async function writeTestIdAuditReport(
  report: TestIdAuditReport,
  reportDir = 'target/atr-healer/reports'
): Promise<string> {
  const directory = path.join(report.workspaceRoot, reportDir);
  await fs.mkdir(directory, { recursive: true });

  const fileName = `test-id-audit-${safeName(report.pageName ?? report.projectPrefix)}-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
  const absolute = path.join(directory, fileName);
  await fs.writeFile(absolute, renderReport(report), 'utf8');
  return absolute;
}

function renderReport(report: TestIdAuditReport): string {
  const lines: string[] = [
    '# ATR Test ID Audit',
    '',
    `Workspace: ${report.workspaceRoot}`,
    `Project prefix: ${report.projectPrefix}`,
    `Page: ${report.pageName ?? 'inferred per file'}`,
    `Scanned files: ${report.scannedFiles.length}`,
    `Existing test IDs: ${report.existing.length}`,
    `Duplicate test IDs: ${report.duplicates.length}`,
    `Proposals: ${report.proposals.length}`,
    ''
  ];

  if (report.warnings.length > 0) {
    lines.push('## Warnings', '');
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

  lines.push('## Duplicate Test IDs', '');
  if (report.duplicates.length === 0) {
    lines.push('No duplicate test IDs were detected.', '');
  } else {
    lines.push('Duplicate IDs must be reviewed because selectors should uniquely identify one logical component.');
    lines.push('');
    lines.push('| Test ID | Occurrences |');
    lines.push('| --- | --- |');
    for (const duplicate of report.duplicates) {
      const occurrences = duplicate.occurrences
        .map(item => `${item.file}:${item.line} <${item.component}>`)
        .join('<br>');
      lines.push(`| \`${duplicate.testId}\` | ${occurrences} |`);
    }
    lines.push('');
  }

  lines.push('## Proposed Test IDs', '');
  if (report.proposals.length === 0) {
    lines.push('No missing test IDs were detected.', '');
  } else {
    lines.push('| File | Line | Component | Proposed ID | Reason |');
    lines.push('| --- | ---: | --- | --- | --- |');
    for (const proposal of report.proposals) {
      lines.push(`| ${proposal.file} | ${proposal.line} | ${proposal.component} | \`${proposal.proposedId}\` | ${proposal.reason} |`);
    }
    lines.push('');
  }

  lines.push('## Existing Test IDs', '');
  if (report.existing.length === 0) {
    lines.push('No existing test IDs were detected.', '');
  } else {
    lines.push('| File | Line | Component | Test ID |');
    lines.push('| --- | ---: | --- | --- |');
    for (const existing of report.existing) {
      lines.push(`| ${existing.file} | ${existing.line} | ${existing.component} | \`${existing.testId}\` |`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function safeName(value: string): string {
  return value
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'project';
}
