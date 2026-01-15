import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateHookSettingsFile } from '@/claude/utils/generateHookSettings';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@/configuration', () => ({
  configuration: {
    happyHomeDir: '/tmp/happy',
    logsDir: '/tmp/happy/logs',
    isDaemonProcess: false
  }
}));
vi.mock('@/projectPath', () => ({ projectPath: () => '/repo' }));

const originalEnv = { ...process.env };

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('generateHookSettingsFile', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    mkdirSync('/tmp/happy/logs', { recursive: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('merges user settings and prepends Happy SessionStart hook', () => {
    const tmpDir = mkdtempSync('/tmp/claude-test-');
    process.env.CLAUDE_CONFIG_DIR = tmpDir;

    const settingsPath = join(tmpDir, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({
      env: { ANTHROPIC_AUTH_TOKEN: 'token' },
      hooks: { SessionStart: [{ matcher: '*', hooks: [{ type: 'command', command: 'user-hook' }] }] },
      permissions: { allow: ['read'] }
    }));

    const path = generateHookSettingsFile(1234);
    const json = readJson(path);

    expect(json.env.ANTHROPIC_AUTH_TOKEN).toBe('token');
    expect(json.permissions.allow).toEqual(['read']);
    expect(json.hooks.SessionStart[0].hooks[0].command).toContain('session_hook_forwarder.cjs');
    expect(json.hooks.SessionStart[1].hooks[0].command).toBe('user-hook');
  });

  it('falls back to Happy hooks-only when user settings are missing', () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    const path = generateHookSettingsFile(1234);
    const json = readJson(path);

    expect(json.hooks.SessionStart[0].hooks[0].command).toContain('session_hook_forwarder.cjs');
  });
});
