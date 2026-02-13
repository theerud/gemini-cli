/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  computeLineHash,
  formatHashline,
  stripHashline,
  parseHashline,
} from './hashline.js';

describe('hashline', () => {
  describe('computeLineHash', () => {
    it('should compute stable 2-char hashes', () => {
      const line = "import { useState } from 'react';";
      const h1 = computeLineHash(line);
      const h2 = computeLineHash(line);
      expect(h1).toHaveLength(2);
      expect(h1).toBe(h2);
    });

    it('should be robust against whitespace', () => {
      const h1 = computeLineHash("  import { useState } from 'react';  ");
      const h2 = computeLineHash("\timport {useState} from'react';");
      expect(h1).toBe(h2);
    });

    it('should handle empty or whitespace-only lines', () => {
      expect(computeLineHash('')).toBe('00');
      expect(computeLineHash('  ')).toBe('00');
      expect(computeLineHash('\t\n')).toBe('00');
    });

    it('should produce different hashes for different content', () => {
      const h1 = computeLineHash('console.log("hello");');
      const h2 = computeLineHash('console.log("world");');
      expect(h1).not.toBe(h2);
    });
  });

  describe('formatHashline', () => {
    it('should format correctly', () => {
      const line = 'const x = 1;';
      const hash = computeLineHash(line);
      expect(formatHashline(line, 42)).toBe(`42:${hash}|${line}`);
    });
  });

  describe('stripHashline', () => {
    it('should strip prefixes', () => {
      expect(stripHashline('10:a1|content')).toBe('content');
      expect(stripHashline('1:z9|  spaced content')).toBe('  spaced content');
    });

    it('should not strip if no prefix', () => {
      const line = 'no prefix here';
      expect(stripHashline(line)).toBe(line);
    });
  });

  describe('parseHashline', () => {
    it('should parse correctly', () => {
      const parsed = parseHashline('123:b2|some code');
      expect(parsed).toEqual({
        lineNum: 123,
        hash: 'b2',
        content: 'some code',
      });
    });

    it('should return null for invalid format', () => {
      expect(parseHashline('invalid')).toBeNull();
      expect(parseHashline('12:abc|too long')).toBeNull();
      expect(parseHashline('a:b1|not a number')).toBeNull();
    });
  });
});
