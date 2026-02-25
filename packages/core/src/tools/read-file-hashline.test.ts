/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from 'vitest';
import { ReadFileTool, type ReadFileToolParams } from './read-file.js';
import type { Config } from '../config/config.js';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { type Schema } from '@google/genai';
import { type MessageBus } from '../confirmation-bus/message-bus.js';

describe('ReadFileTool - Hashline Integration', () => {
  let mockConfig: Config;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      getTargetDir: () => '/root',
      getEnableHashline: vi.fn().mockReturnValue(true),
      getUsageStatisticsEnabled: () => false,
      getFileSystemService: () => ({}),
      getFileFilteringOptions: () => ({}),
      validatePathAccess: () => null,
      getApprovalMode: () => 'default',
    } as unknown as Config;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should include hashes in output when requested and enabled', async () => {
    const content = 'line 1\nline 2';

    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const statSpy = vi.spyOn(fsPromises, 'stat').mockResolvedValue({
      size: content.length,
      isDirectory: () => false,
    } as unknown as fs.Stats);
    const readFileSpy = vi
      .spyOn(fsPromises, 'readFile')
      .mockResolvedValue(Buffer.from(content) as unknown as string);

    const tool = new ReadFileTool(mockConfig, {} as unknown as MessageBus);

    const params: ReadFileToolParams = {
      file_path: 'test.txt',
      include_hashes: true,
    };

    const invocation = tool.build(params);
    const result = await invocation.execute(new AbortController().signal);

    expect(result.llmContent).toMatch(/1#[A-Z2-9]{3}:line 1/);
    expect(result.llmContent).toMatch(/2#[A-Z2-9]{3}:line 2/);

    existsSpy.mockRestore();
    statSpy.mockRestore();
    readFileSpy.mockRestore();
  });

  it('should NOT include hashes in schema if disabled in config', async () => {
    (mockConfig.getEnableHashline as Mock).mockReturnValue(false);

    const tool = new ReadFileTool(mockConfig, {} as unknown as MessageBus);

    const schema = tool.getSchema();
    const parameters = schema.parametersJsonSchema as Schema;
    expect(parameters.properties).not.toHaveProperty('include_hashes');
  });

  it('should include hashes in schema if enabled in config', async () => {
    (mockConfig.getEnableHashline as Mock).mockReturnValue(true);

    const tool = new ReadFileTool(mockConfig, {} as unknown as MessageBus);

    const schema = tool.getSchema();
    const parameters = schema.parametersJsonSchema as Schema;
    expect(parameters.properties).toHaveProperty('include_hashes');
  });
});
