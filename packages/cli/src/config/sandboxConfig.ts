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
const VALID_SANDBOX_COMMANDS = [
  'docker',
  'podman',
  'sandbox-exec',
  'bwrap',
  'runsc',
  'lxc',
];

export function isSandboxCommand(
  value: string,
): value is Exclude<SandboxConfig['command'], undefined> {
  return (VALID_SANDBOX_COMMANDS as ReadonlyArray<string | undefined>).includes(
    value,
  );
}

function getSandboxCommand(
  sandbox?: boolean | string | null,
): SandboxConfig['command'] | '' {
  // If the SANDBOX env var is set, we're already inside the sandbox.
  if (process.env['SANDBOX']) {
    return '';
  }

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
        `Invalid sandbox command '${val}'. Must be one of ${VALID_SANDBOX_COMMANDS.join(', ')}`,
      );
    }
    // runsc (gVisor) is only supported on Linux
    if (sandbox === 'runsc' && os.platform() !== 'linux') {
      throw new FatalSandboxError(
        'gVisor (runsc) sandboxing is only supported on Linux',
      );
    }
    // confirm that specified command exists
    if (!commandExists.sync(val)) {
      throw new FatalSandboxError(
        `Missing sandbox command '${val}' (from GEMINI_SANDBOX)`,
      );
    }
    // runsc uses Docker with --runtime=runsc; both must be available (prioritize runsc when explicitly chosen)
    if (val === 'runsc' && !commandExists.sync('docker')) {
      throw new FatalSandboxError(
        "runsc (gVisor) requires Docker. Install Docker, or use sandbox: 'docker'.",
      );
    }
    return val;
  }

  // look for seatbelt, docker, or podman, in that order
  // for container-based sandboxing, require sandbox to be enabled explicitly
  // note: runsc is NOT auto-detected, it must be explicitly specified
  if (os.platform() === 'darwin' && commandExists.sync('sandbox-exec')) {
    return 'sandbox-exec';
  }

  for (const cmd of ['docker', 'podman', 'bwrap'] as const) {
    if (commandExists.sync(cmd)) return cmd;
  }

  if (sandbox === true) {
    throw new FatalSandboxError(
      'Sandbox is enabled but no supported engine (bwrap, docker, podman) was found in PATH.',
    );
  }

  return '';
  // Note: 'lxc' is intentionally not auto-detected because it requires a
  // pre-existing, running container managed by the user. Use
  // GEMINI_SANDBOX=lxc or sandbox: "lxc" in settings to enable it.
}

export async function loadSandboxConfig(
  settings: Settings,
  argv: SandboxCliArgs,
): Promise<SandboxConfig | undefined> {
  const sandboxOption = argv.sandbox ?? settings.tools?.sandbox;

  let sandboxValue: boolean | string | null | undefined;
  let allowedPaths: string[] = [];
  let networkAccess = false;
  let customImage: string | undefined;

  if (
    typeof sandboxOption === 'object' &&
    sandboxOption !== null &&
    !Array.isArray(sandboxOption)
  ) {
    const config = sandboxOption;
    sandboxValue = config.enabled ? (config.command ?? true) : false;
    allowedPaths = config.allowedPaths ?? [];
    networkAccess = config.networkAccess ?? false;
    customImage = config.image;
  } else if (typeof sandboxOption !== 'object' || sandboxOption === null) {
    sandboxValue = sandboxOption;
  }

  const command = getSandboxCommand(sandboxValue);

  const packageJson = await getPackageJson(__dirname);
  const image =
    process.env['GEMINI_SANDBOX_IMAGE'] ??
    process.env['GEMINI_SANDBOX_IMAGE_DEFAULT'] ??
    customImage ??
    packageJson?.config?.sandboxImageUri;

  return command && image
    ? { enabled: true, allowedPaths, networkAccess, command, image }
    : undefined;
}
