/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { calculateReplacement } from './edit.js';
import { computeLineHash } from '../utils/hashline.js';
import type { Config } from '../config/config.js';

describe('Edit Tool - Hashline Strategy', () => {
  const mockConfig = {
    getHashlineEditMode: () => true,
    getDisableLLMCorrection: () => true,
    getUsageStatisticsEnabled: () => false,
  } as unknown as Config;

  const abortSignal = new AbortController().signal;

  it('should apply a hashline-based replacement', async () => {
    const currentContent = 'line 1\nline 2\nline 3';
    const h2 = computeLineHash('line 2');

    const params = {
      file_path: 'test.ts',
      old_string: `2:${h2}|line 2`,
      new_string: 'line 2 modified',
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent,
      abortSignal,
    });

    expect(result.occurrences).toBe(1);
    expect(result.newContent).toBe('line 1\nline 2 modified\nline 3');
  });

  it('should relocate the anchor if line numbers shifted', async () => {
    // line 2 shifted to line 3
    const currentContent = 'new line\nline 1\nline 2\nline 3';
    const h2 = computeLineHash('line 2');

    const params = {
      file_path: 'test.ts',
      // LLM thinks it is at line 2
      old_string: `2:${h2}|line 2`,
      new_string: 'line 2 modified',
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent,
      abortSignal,
    });

    expect(result.occurrences).toBe(1);
    expect(result.newContent).toBe('new line\nline 1\nline 2 modified\nline 3');
  });

  it('should handle indentation robustness', async () => {
    const currentContent = '  if (true) {\n    console.log("hi");\n  }';
    const h2 = computeLineHash('    console.log("hi");');

    const params = {
      file_path: 'test.ts',
      // LLM might have wrong indentation in old_string, but the hash is based on trimmed content
      old_string: `2:${h2}|console.log("hi");`,
      new_string: 'console.log("hello");',
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent,
      abortSignal,
    });

    expect(result.occurrences).toBe(1);
    // Should preserve original indentation
    expect(result.newContent).toBe(
      '  if (true) {\n    console.log("hello");\n  }',
    );
  });

  it('should fall back to exact match if hashline prefix is missing', async () => {
    const currentContent = 'line 1\nline 2\nline 3';

    const params = {
      file_path: 'test.ts',
      old_string: 'line 2',
      new_string: 'line 2 modified',
    };

    const result = await calculateReplacement(mockConfig, {
      params,
      currentContent,
      abortSignal,
    });

    expect(result.occurrences).toBe(1);
    expect(result.newContent).toBe('line 1\nline 2 modified\nline 3');
  });
});
