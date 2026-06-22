import { promises as fs } from 'fs';
import path from 'path';
import { AtrCliOptions } from './types';

interface UsageLedger {
  day: string;
  calls: number;
}

export async function assertAiBudget(
  options: AtrCliOptions,
  messages: Array<{ role: string; content: string }>
): Promise<void> {
  const promptChars = messages.reduce((total, message) => total + message.content.length, 0);
  if (promptChars > options.aiMaxPromptChars) {
    throw new Error(`AI prompt blocked by budget guard: ${promptChars} chars exceeds ${options.aiMaxPromptChars}.`);
  }

  const ledger = await readLedger(options);
  if (ledger.calls >= options.aiDailyCallLimit) {
    throw new Error(`AI request blocked by daily free-tier guard: ${ledger.calls}/${options.aiDailyCallLimit} calls already used today.`);
  }
}

export async function recordAiCall(options: AtrCliOptions): Promise<void> {
  const ledger = await readLedger(options);
  ledger.calls++;
  await writeLedger(options, ledger);
}

async function readLedger(options: AtrCliOptions): Promise<UsageLedger> {
  const today = new Date().toISOString().slice(0, 10);
  const file = ledgerPath(options);

  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as UsageLedger;
    if (parsed.day === today && Number.isFinite(parsed.calls)) {
      return parsed;
    }
  } catch {
    // Missing or invalid ledger starts a new daily budget.
  }

  return {
    day: today,
    calls: 0
  };
}

async function writeLedger(options: AtrCliOptions, ledger: UsageLedger): Promise<void> {
  const file = ledgerPath(options);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

function ledgerPath(options: AtrCliOptions): string {
  return path.join(options.workspaceRoot, options.reportDir, 'usage-ledger.json');
}

