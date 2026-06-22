import { spawn } from 'child_process';
import { AtrCliOptions, TestRunResult } from './types';

export async function runTestCommand(options: AtrCliOptions, attempt: number): Promise<TestRunResult> {
  const started = Date.now();

  return new Promise(resolve => {
    const child = spawn(options.testCommand, {
      cwd: options.workspaceRoot,
      shell: true,
      env: {
        ...process.env,
        ATR_FEATURE_FILE: options.featureFile ?? '',
        ATR_SCENARIO_NAME: options.scenarioName ?? ''
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('close', exitCode => {
      resolve({
        attempt,
        command: options.testCommand,
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - started
      });
    });
  });
}

