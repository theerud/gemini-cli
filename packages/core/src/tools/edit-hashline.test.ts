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

  it('should apply a single hashline edit successfully', async () => {
    const originalContent = 'line 1\nline 2\nline 3';
    const annotated = annotateContent(originalContent);
    const idLine2 = annotated.split('\n')[1].split(':')[0]; // e.g. "2#ABC"

    const params: EditToolParams = {
      file_path: filePath,
      instruction: 'edit',
      old_string: '',
      new_string: '',
      line_edits: [{ id: idLine2, new_content: 'line 2 modified' }],
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent: originalContent,
      abortSignal: new AbortController().signal,
    });

    expect(result.strategy).toBe('hashline');
    expect(result.newContent).toBe('line 1\nline 2 modified\nline 3');
    expect(result.occurrences).toBe(1);
  });

  it('should apply multiple hashline edits bottom-up', async () => {
    const originalContent = 'line 1\nline 2\nline 3';
    const annotated = annotateContent(originalContent);
    const ids = annotated.split('\n').map((l) => l.split(':')[0]);

    const params: EditToolParams = {
      file_path: filePath,
      instruction: 'edit',
      old_string: '',
      new_string: '',
      line_edits: [
        { id: ids[0], new_content: 'line 1 modified' },
        { id: ids[2], new_content: 'line 3 modified' },
      ],
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent: originalContent,
      abortSignal: new AbortController().signal,
    });

    expect(result.newContent).toBe('line 1 modified\nline 2\nline 3 modified');
  });

  it('should return HASH_MISMATCH if a hashline ID does not match content', async () => {
    const originalContent = 'line 1\nline 2\nline 3';

    const params: EditToolParams = {
      file_path: filePath,
      instruction: 'edit',
      old_string: '',
      new_string: '',
      line_edits: [{ id: '2#WRONG', new_content: 'will fail' }],
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent: originalContent,
      abortSignal: new AbortController().signal,
    });

    expect(result.strategy).toBe('hashline');
    expect(result.occurrences).toBe(0);
    expect(result.finalOldString).toBe('HASH_MISMATCH');
    expect(result.newContent).toBe(originalContent);
  });

  it('should fail if index is out of bounds', async () => {
    const originalContent = 'line 1';

    const params: EditToolParams = {
      file_path: filePath,
      instruction: 'edit',
      old_string: '',
      new_string: '',
      line_edits: [{ id: '10#ABC', new_content: 'invalid' }],
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent: originalContent,
      abortSignal: new AbortController().signal,
    });

    expect(result.occurrences).toBe(0);
    expect(result.finalOldString).toBe('HASH_MISMATCH');
  });

  describe('Hashline v2', () => {
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
      expect(result.newContent).toBe(
        'line 1\nline 2-3 modified\nline 4\nline 5',
      );
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
          { op: 'replace', pos: '2#XXX', lines: ['invalid'] },
          { op: 'append', pos: '4#OUT', lines: ['invalid'] },
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

    it('should apply safety heuristic for "replace"', async () => {
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

      // It should trim 'line 3' from the replacement
      expect(result.newContent).toBe('line 1\nline 2 modified\nline 3\nline 4');
    });
  });
});
