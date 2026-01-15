/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, exec, execSync, type ChildProcess } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import { start_sandbox } from './sandbox.js';
import { type SandboxConfig } from '@google/gemini-cli-core';
import { EventEmitter } from 'node:events';

const { mockedHomedir, mockedGetContainerPath } = vi.hoisted(() => ({
  mockedHomedir: vi.fn().mockReturnValue('/home/user'),
  mockedGetContainerPath: vi.fn().mockImplementation((p: string) => p),
}));

vi.mock('./sandboxUtils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sandboxUtils.js')>();
  return {
    ...actual,
    getContainerPath: mockedGetContainerPath,
  };
});

vi.mock('node:child_process');
vi.mock('node:os');
vi.mock('node:fs');
vi.mock('node:util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:util')>();
  return {
    ...actual,
    promisify: (fn: (...args: unknown[]) => unknown) => {
      if (fn === exec) {
        return async (cmd: string) => {
          if (cmd === 'id -u' || cmd === 'id -g') {
            return { stdout: '1000', stderr: '' };
          }
          return { stdout: '', stderr: '' };
        };
      }
      return actual.promisify(fn);
    },
  };
});

vi.mock('@google/gemini-cli-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@google/gemini-cli-core')>();
  return {
    ...actual,
    debugLogger: {
      log: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    },
    coreEvents: {
      emitFeedback: vi.fn(),
    },
    FatalSandboxError: class extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'FatalSandboxError';
      }
    },
    GEMINI_DIR: '.gemini',
    homedir: mockedHomedir,
  };
});

interface MockProcess extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
}

describe('sandbox-bwrap', () => {
  const originalEnv = process.env;
  const originalArgv = process.argv;
  let mockProcessIn: {
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    isTTY: boolean;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.argv = [...originalArgv];
    mockProcessIn = {
      pause: vi.fn(),
      resume: vi.fn(),
      isTTY: true,
    };
    Object.defineProperty(process, 'stdin', {
      value: mockProcessIn,
      writable: true,
    });
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(os.homedir).mockReturnValue('/home/user');
    vi.mocked(os.tmpdir).mockReturnValue('/tmp');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.realpathSync).mockImplementation((p) => p as string);
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));
  });

  afterEach(() => {
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  describe('start_sandbox with bwrap', () => {
    it('should handle bwrap execution with hardening flags and adaptive bindings', async () => {
      const config: SandboxConfig = {
        command: 'bwrap',
        image: 'host', // image is mostly ignored for bwrap in this mode
      };

      const mockSpawnProcess = new EventEmitter() as MockProcess;
      mockSpawnProcess.on = vi.fn().mockImplementation((event, cb) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 10);
        }
        return mockSpawnProcess;
      });
      vi.mocked(spawn).mockReturnValue(
        mockSpawnProcess as unknown as ChildProcess,
      );

      const promise = start_sandbox(config, [], undefined, ['arg1']);

      await expect(promise).resolves.toBe(0);
      expect(spawn).toHaveBeenCalledWith(
        'bwrap',
        expect.arrayContaining([
          '--unshare-all',
          '--share-net',
          '--die-with-parent',
          '--new-session',
          '--cap-drop',
          'ALL',
          '--proc',
          '/proc',
          '--dev',
          '/dev',
          '--tmpfs',
          '/tmp',
          '--ro-bind-try',
          '/usr',
          '/usr',
        ]),
        expect.objectContaining({ stdio: 'inherit' }),
      );
    });

    it('should handle bwrap execution when specified via string argument', async () => {
      const config: SandboxConfig = {
        command: 'bwrap',
        image: 'host',
      };

      const mockSpawnProcess = new EventEmitter() as MockProcess;
      mockSpawnProcess.on = vi.fn().mockImplementation((event, cb) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 10);
        }
        return mockSpawnProcess;
      });
      vi.mocked(spawn).mockReturnValue(
        mockSpawnProcess as unknown as ChildProcess,
      );

      const promise = start_sandbox(config);

      await expect(promise).resolves.toBe(0);
      expect(spawn).toHaveBeenCalledWith(
        'bwrap',
        expect.arrayContaining(['--unshare-all']),
        expect.any(Object),
      );
    });

    it('should include architecture-specific paths for x64', async () => {
      const config: SandboxConfig = { command: 'bwrap', image: 'host' };
      Object.defineProperty(process, 'arch', { value: 'x64' });

      const mockSpawnProcess = new EventEmitter() as MockProcess;
      mockSpawnProcess.on = vi.fn().mockImplementation((event, cb) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 10);
        }
        return mockSpawnProcess;
      });
      vi.mocked(spawn).mockReturnValue(
        mockSpawnProcess as unknown as ChildProcess,
      );

      await start_sandbox(config);

      expect(spawn).toHaveBeenCalledWith(
        'bwrap',
        expect.arrayContaining([
          '--ro-bind-try',
          '/lib/x86_64-linux-gnu',
          '/lib/x86_64-linux-gnu',
        ]),
        expect.any(Object),
      );
    });

    it('should create .gemini directory if it does not exist', async () => {
      const config: SandboxConfig = { command: 'bwrap', image: 'host' };
      const userSettingsPath = '/home/user/.gemini';

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === userSettingsPath) return false;
        return true;
      });
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      const mockSpawnProcess = new EventEmitter() as MockProcess;
      mockSpawnProcess.on = vi.fn().mockImplementation((event, cb) => {
        if (event === 'close') setTimeout(() => cb(0), 10);
        return mockSpawnProcess;
      });
      vi.mocked(spawn).mockReturnValue(
        mockSpawnProcess as unknown as ChildProcess,
      );

      await start_sandbox(config);

      expect(fs.mkdirSync).toHaveBeenCalledWith(userSettingsPath, {
        recursive: true,
      });
    });

    it('should include NixOS paths if /nix/store exists', async () => {
      const config: SandboxConfig = { command: 'bwrap', image: 'host' };
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === '/nix/store') return true;
        if (p === '/nix') return true;
        return true; // default to true for other paths like workspace etc
      });

      const mockSpawnProcess = new EventEmitter() as MockProcess;
      mockSpawnProcess.on = vi.fn().mockImplementation((event, cb) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 10);
        }
        return mockSpawnProcess;
      });
      vi.mocked(spawn).mockReturnValue(
        mockSpawnProcess as unknown as ChildProcess,
      );

      await start_sandbox(config);

      expect(spawn).toHaveBeenCalledWith(
        'bwrap',
        expect.arrayContaining(['--ro-bind-try', '/nix', '/nix']),
        expect.any(Object),
      );
    });

    it('should pass environment variables correctly', async () => {
      const config: SandboxConfig = { command: 'bwrap', image: 'host' };
      process.env['GEMINI_API_KEY'] = 'test-key';
      process.env['SANDBOX_ENV'] = 'CUSTOM_VAR=custom-value';

      const mockSpawnProcess = new EventEmitter() as MockProcess;
      mockSpawnProcess.on = vi.fn().mockImplementation((event, cb) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 10);
        }
        return mockSpawnProcess;
      });
      vi.mocked(spawn).mockReturnValue(
        mockSpawnProcess as unknown as ChildProcess,
      );

      await start_sandbox(config);

      expect(spawn).toHaveBeenCalledWith(
        'bwrap',
        expect.arrayContaining([
          '--setenv',
          'GEMINI_API_KEY',
          'test-key',
          '--setenv',
          'CUSTOM_VAR',
          'custom-value',
        ]),
        expect.any(Object),
      );
    });
  });
});
