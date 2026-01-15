/**
 * Generate temporary settings file with Claude hooks for session tracking
 * 
 * Creates a settings.json file that configures Claude's SessionStart hook
 * to notify our HTTP server when sessions change (new session, resume, compact, etc.)
 */

import { join, resolve } from 'node:path';
import { writeFileSync, mkdirSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { configuration } from '@/configuration';
import { logger } from '@/ui/logger';
import { projectPath } from '@/projectPath';

/**
 * Generate a temporary settings file with SessionStart hook configuration
 * 
 * @param port - The port where Happy server is listening
 * @returns Path to the generated settings file
 */
export function generateHookSettingsFile(port: number): string {
    const hooksDir = join(configuration.happyHomeDir, 'tmp', 'hooks');
    mkdirSync(hooksDir, { recursive: true });

    // Unique filename per process to avoid conflicts
    const filename = `session-hook-${process.pid}.json`;
    const filepath = join(hooksDir, filename);

    // Path to the hook forwarder script
    const forwarderScript = resolve(projectPath(), 'scripts', 'session_hook_forwarder.cjs');
    const hookCommand = `node "${forwarderScript}" ${port}`;

    let settings: Record<string, any> = {
        hooks: {
            SessionStart: [
                {
                    matcher: "*",
                    hooks: [
                        {
                            type: "command",
                            command: hookCommand
                        }
                    ]
                }
            ]
        }
    };

    const happyHook = settings.hooks.SessionStart[0];
    const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
    const settingsPath = join(claudeConfigDir, 'settings.json');

    if (existsSync(settingsPath)) {
        try {
            const userSettings = JSON.parse(readFileSync(settingsPath, 'utf-8')) as Record<string, any>;
            const sessionStart = userSettings.hooks?.SessionStart;
            const sessionStartArray = Array.isArray(sessionStart)
                ? sessionStart
                : sessionStart
                    ? [sessionStart]
                    : [];
            const duplicate = sessionStartArray.some((entry) => {
                return entry?.hooks?.some((hook: { command?: string }) => hook?.command === hookCommand);
            });

            if (duplicate) {
                logger.warn('[generateHookSettings] Duplicate SessionStart hook detected; inserting anyway');
            }

            settings = { ...userSettings };
            settings.hooks = settings.hooks || {};
            settings.hooks.SessionStart = [happyHook, ...sessionStartArray];
        } catch (error) {
            logger.warn(`[generateHookSettings] Failed to read user settings: ${error}`);
        }
    } else {
        logger.debug(`[generateHookSettings] No user settings at ${settingsPath}`);
    }

    writeFileSync(filepath, JSON.stringify(settings, null, 2));
    logger.debug(`[generateHookSettings] Created hook settings file: ${filepath}`);

    return filepath;
}

/**
 * Clean up the temporary hook settings file
 * 
 * @param filepath - Path to the settings file to remove
 */
export function cleanupHookSettingsFile(filepath: string): void {
    try {
        if (existsSync(filepath)) {
            unlinkSync(filepath);
            logger.debug(`[generateHookSettings] Cleaned up hook settings file: ${filepath}`);
        }
    } catch (error) {
        logger.debug(`[generateHookSettings] Failed to cleanup hook settings file: ${error}`);
    }
}

