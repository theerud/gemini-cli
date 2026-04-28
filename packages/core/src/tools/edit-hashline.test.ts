/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateReplacement, type EditToolParams } from './edit.js';
import type { Config } from '../config/config.js';
import { annotateContent, HashlineMismatchError } from '../utils/hashline.js';

describe('Edit Tool - Hashline Integration', () => {
  let mockConfig: Config;
  const filePath = 'test.ts';

  beforeEach(() => {
    mockConfig = {
      getTargetDir: () => '/',
      getEnableHashline: vi.fn().mockReturnValue(true),
      getUsageStatisticsEnabled: () => false,
    } as unknown as Config;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getIds = (content: string) =>
    annotateContent(content)
      .split('\n')
      .map((l) => l.split(':')[0]);

  it('should apply "replace" range successfully', async () => {
    const originalContent = 'line 1\nline 2\nline 3\nline 4\nline 5';
    const ids = getIds(originalContent);

    const params: EditToolParams = {
      file_path: filePath,
      instruction: 'edit',
      edits: [
        {
          op: 'replace',
          pos: ids[1], // line 2
          end: ids[2], // line 3
          lines: ['line 2-3 modified'],
        },
      ],
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent: originalContent,
      abortSignal: new AbortController().signal,
    });

    expect(result.strategy).toBe('hashline');
    expect(result.newContent).toBe('line 1\nline 2-3 modified\nline 4\nline 5');
    expect(result.occurrences).toBe(1);
  });

  it('should apply "append" successfully', async () => {
    const originalContent = 'line 1\nline 2\nline 3';
    const ids = getIds(originalContent);

    const params: EditToolParams = {
      file_path: filePath,
      instruction: 'edit',
      edits: [
        {
          op: 'append',
          pos: ids[1], // after line 2
          lines: ['line 2.5'],
        },
      ],
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent: originalContent,
      abortSignal: new AbortController().signal,
    });

    expect(result.newContent).toBe('line 1\nline 2\nline 2.5\nline 3');
  });

  it('should apply "prepend" successfully', async () => {
    const originalContent = 'line 1\nline 2\nline 3';
    const ids = getIds(originalContent);

    const params: EditToolParams = {
      file_path: filePath,
      instruction: 'edit',
      edits: [
        {
          op: 'prepend',
          pos: ids[1], // before line 2
          lines: ['line 1.5'],
        },
      ],
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent: originalContent,
      abortSignal: new AbortController().signal,
    });

    expect(result.newContent).toBe('line 1\nline 1.5\nline 2\nline 3');
  });

  it('should collect multiple mismatches and throw HashlineMismatchError', async () => {
    const originalContent = 'line 1\nline 2\nline 3';

    const params: EditToolParams = {
      file_path: filePath,
      instruction: 'edit',
      edits: [
        { op: 'replace', pos: '2#XX', lines: ['invalid'] },
        { op: 'append', pos: '4#OU', lines: ['invalid'] },
      ],
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent: originalContent,
      abortSignal: new AbortController().signal,
    });

    expect(result.strategy).toBe('hashline');
    expect(result.occurrences).toBe(0);
    expect(result.finalOldString).toBe('HASH_MISMATCH');
    expect(result.hashlineError).toBeInstanceOf(HashlineMismatchError);
    expect(result.hashlineError?.mismatches).toHaveLength(2);
  });

  it('should apply safety heuristic for "replace" correctly preserving braces', async () => {
    const originalContent = 'line 1\nline 2\nline 3\nline 4';
    const ids = getIds(originalContent);

    const params: EditToolParams = {
      file_path: filePath,
      instruction: 'edit',
      edits: [
        {
          op: 'replace',
          pos: ids[1], // line 2
          lines: ['line 2 modified', 'line 3'], // Duplicates line 3
        },
      ],
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent: originalContent,
      abortSignal: new AbortController().signal,
    });

    // Warning is emitted but line is preserved!
    expect(result.newContent).toBe(
      'line 1\nline 2 modified\nline 3\nline 3\nline 4',
    );
  });
});
