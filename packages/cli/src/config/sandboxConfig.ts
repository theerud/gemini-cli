/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getPackageJson,
  type SandboxConfig,
  FatalSandboxError,
} from '@google/gemini-cli-core';
import commandExists from 'command-exists';
import * as os from 'node:os';
import type { Settings } from './settings.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This is a stripped-down version of the CliArgs interface from config.ts
// to avoid circular dependencies.
interface SandboxCliArgs {
  sandbox?: boolean | string | null;
}
export const VALID_SANDBOX_COMMANDS: ReadonlyArray<SandboxConfig['command']> = [
  'docker',
  'podman',
  'sandbox-exec',
  'bwrap',
];

export function isSandboxCommand(
  value: string,
): value is SandboxConfig['command'] {
  return (VALID_SANDBOX_COMMANDS as readonly string[]).includes(value);
}

function getSandboxCommand(
  sandbox?: boolean | string | null,
): SandboxConfig['command'] | '' {
  if (process.env['SANDBOX']) return '';

  // Priority: Env Var > CLI Arg / Settings
  const env = process.env['GEMINI_SANDBOX']?.toLowerCase().trim();
  let val: string | boolean = (env || sandbox) ?? false;

  // Canonicalize boolean-like strings
  if (val === 'true' || val === '1') val = true;
  if (val === 'false' || val === '0') val = false;

  if (val === false) return '';

  // Explicit engine request
  if (typeof val === 'string') {
    if (!isSandboxCommand(val)) {
      throw new FatalSandboxError(
        `Invalid sandbox engine '${val}'. Must be one of: ${VALID_SANDBOX_COMMANDS.join(', ')}`,
      );
    }
    if (commandExists.sync(val)) return val;
    throw new FatalSandboxError(
      `Sandbox engine '${val}' requested but not found in PATH.`,
    );
  }

  // Auto-discovery (val === true)
  if (os.platform() === 'darwin' && commandExists.sync('sandbox-exec')) {
    return 'sandbox-exec';
  }

  for (const cmd of ['docker', 'podman', 'bwrap'] as const) {
    if (commandExists.sync(cmd)) return cmd;
  }

  throw new FatalSandboxError(
    'Sandbox is enabled but no supported engine (bwrap, docker, podman) was found in PATH.',
  );
}

export async function loadSandboxConfig(
  settings: Settings,
  argv: SandboxCliArgs,
): Promise<SandboxConfig | undefined> {
  const sandboxOption = argv.sandbox ?? settings.tools?.sandbox;
  const command = getSandboxCommand(sandboxOption);

  const packageJson = await getPackageJson(__dirname);
  const image =
    process.env['GEMINI_SANDBOX_IMAGE'] ?? packageJson?.config?.sandboxImageUri;

  if (command === 'bwrap') {
    return { command, image: image ?? 'host' };
  }

  return command && image ? { command, image } : undefined;
}
