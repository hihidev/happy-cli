#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

// Ensure Node flags to reduce noisy warnings on stdout (which could interfere with MCP)
const hasNoWarnings = process.execArgv.includes('--no-warnings');
const hasNoDeprecation = process.execArgv.includes('--no-deprecation');

if (!hasNoWarnings || !hasNoDeprecation) {
  const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const entrypoint = join(projectRoot, 'dist', 'codex', 'happyMcpStdioBridge.mjs');

  // Use spawn instead of execFileSync for proper signal forwarding
  const child = spawn(process.execPath, [
    '--no-warnings',
    '--no-deprecation',
    entrypoint,
    ...process.argv.slice(2)
  ], {
    stdio: 'inherit',
    env: process.env
  });

  // Forward signals to the child process
  const signals = ['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGUSR1', 'SIGUSR2'];
  for (const signal of signals) {
    process.on(signal, () => {
      if (!child.killed) {
        child.kill(signal);
      }
    });
  }

  // Exit when child exits
  child.on('exit', (code, signal) => {
    if (signal) {
      process.exit(128 + 15); // Standard exit code for terminated by signal
    } else {
      process.exit(code || 0);
    }
  });

  // Handle errors
  child.on('error', (error) => {
    process.stderr.write(`[happy-mcp-wrapper] Failed to start bridge: ${error.message}\n`);
    process.exit(1);
  });
} else {
  // Already have desired flags; import module directly
  import('../dist/codex/happyMcpStdioBridge.mjs');
}

