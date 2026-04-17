/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  generateHash,
  generateFileHashes,
  annotateContent,
  parseHashline,
  HashlineMismatchError,
  formatMismatchDiagnostic,
} from './hashline.js';

describe('hashline utility', () => {
  describe('generateHash', () => {
    it('should generate a 3-character hash', () => {
      const hash = generateHash('export function hello() {', 1);
      expect(hash).toHaveLength(3);
      expect(hash).toMatch(/^[A-Z2-9]{3}$/);
    });

    it('should be whitespace-neutral', () => {
      const hash1 = generateHash('  export function hello() {  ', 1);
      const hash2 = generateHash('export function hello(){', 1);
      expect(hash1).toBe(hash2);
    });

    it.each([
      {
        desc: 'different contextHash',
        inputs: [
          { content: '}', index: 10, context: 'AAA' },
          { content: '}', index: 20, context: 'BBB' },
        ] as Array<{ content: string; index: number; context?: string }>,
        expectedEqual: false,
      },
      {
        desc: 'different index (fallback)',
        inputs: [
          { content: '}', index: 1 },
          { content: '}', index: 2 },
        ] as Array<{ content: string; index: number; context?: string }>,
        expectedEqual: false,
      },
    ])(
      'should differentiate symbols based on $desc',
      ({ inputs, expectedEqual }) => {
        const hash1 = generateHash(
          inputs[0].content,
          inputs[0].index,
          inputs[0].context,
        );
        const hash2 = generateHash(
          inputs[1].content,
          inputs[1].index,
          inputs[1].context,
        );
        if (expectedEqual) {
          expect(hash1).toBe(hash2);
        } else {
          expect(hash1).not.toBe(hash2);
        }
      },
    );
  });

  describe('generateFileHashes', () => {
    it('should anchor symbolic lines to the previous stable line', () => {
      const content = `
function a() {
  return 1;
}

function b() {
  return 2;
}
`.trim();
      const hashes = generateFileHashes(content);
      // function a() { -> stable
      //   return 1; -> stable
      // } -> symbolic, anchored to return 1
      // (empty) -> symbolic, anchored to return 1
      // function b() { -> stable

      const lines = content.split('\n');
      const hashOfReturn1 = hashes[1];
      const hashOfBrace1 = hashes[2];
      const hashOfEmpty = hashes[3];
      const hashOfFunctionB = hashes[4];

      expect(hashOfBrace1).toBe(generateHash(lines[2], 3, hashOfReturn1));
      expect(hashOfEmpty).toBe(generateHash(lines[3], 4, hashOfReturn1));
      expect(hashOfFunctionB).toBe(generateHash(lines[4], 5)); // new stable context
    });
  });

  describe('parseHashline', () => {
    it('should correctly parse a formatted line', () => {
      const line = '42#WS3:  export function run() {';
      const parsed = parseHashline(line);
      expect(parsed).toEqual({
        index: 42,
        hash: 'WS3',
        content: '  export function run() {',
      });
    });

    it('should return null for invalid format', () => {
      expect(parseHashline('invalid line')).toBeNull();
      expect(parseHashline('42#W:content')).toBeNull(); // Hash too short
    });
  });

  describe('annotateContent', () => {
    it('should prefix all lines with hashline IDs', () => {
      const content = 'line1\nline2';
      const annotated = annotateContent(content);
      const lines = annotated.split('\n');
      expect(lines[0]).toMatch(/^1#[A-Z2-9]{3}:line1$/);
      expect(lines[1]).toMatch(/^2#[A-Z2-9]{3}:line2$/);
    });

    it('should support absolute numbering with an offset', () => {
      const content = 'line10\nline11';
      const annotated = annotateContent(content, 10);
      const lines = annotated.split('\n');
      expect(lines[0]).toMatch(/^10#[A-Z2-9]{3}:line10$/);
      expect(lines[1]).toMatch(/^11#[A-Z2-9]{3}:line11$/);
    });

    it('should maintain hash stability when using pre-calculated hashes', () => {
      const fullContent = 'const a = 1;\n\n}';
      const fullHashes = generateFileHashes(fullContent);
      const snippet = '}';
      // Without pre-calculated hashes, '}' at start of snippet would hash differently
      // than '}' at line 3 of fullContent (which is anchored to line 1).
      const annotated = annotateContent(snippet, 3, [fullHashes[2]]);
      expect(annotated).toBe(`3#${fullHashes[2]}:}`);
    });
  });

  describe('HashlineMismatchError', () => {
    it('should hold mismatch details', () => {
      const mismatches = [{ line: 5, expected: 'ABC', actual: 'DEF' }];
      const error = new HashlineMismatchError(mismatches);
      expect(error.mismatches).toEqual(mismatches);
      expect(error.message).toBe('Hashline mismatch detected');
    });
  });

  describe('formatMismatchDiagnostic', () => {
    it('should format a recovery diagnostic with context', () => {
      const content = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join(
        '\n',
      );
      const lines = content.split('\n');
      const hashes = generateFileHashes(content);
      const mismatches = [{ line: 5, expected: 'WRONG', actual: hashes[4] }];

      const diagnostic = formatMismatchDiagnostic(mismatches, lines);

      expect(diagnostic).toContain('HASHLINE MISMATCH DETECTED');
      expect(diagnostic).toContain('>>> 5#');
      expect(diagnostic).toContain('    3#');
      expect(diagnostic).toContain('    7#');
      expect(diagnostic).not.toContain('    1#'); // Too far from line 5
      expect(diagnostic).not.toContain('    10#'); // Too far from line 5
    });

    it('should handle multiple mismatches and overlapping context', () => {
      const content = Array.from({ length: 15 }, (_, i) => `line${i + 1}`).join(
        '\n',
      );
      const lines = content.split('\n');
      const hashes = generateFileHashes(content);
      const mismatches = [
        { line: 3, expected: 'W1', actual: hashes[2] },
        { line: 5, expected: 'W2', actual: hashes[4] },
        { line: 12, expected: 'W3', actual: hashes[11] },
      ];

      const diagnostic = formatMismatchDiagnostic(mismatches, lines);

      // Lines 3 and 5 should have context that overlaps or is adjacent
      // Line 3 context: 1, 2, 3, 4, 5
      // Line 5 context: 3, 4, 5, 6, 7
      // Together: 1, 2, 3, 4, 5, 6, 7
      expect(diagnostic).toContain('>>> 3#');
      expect(diagnostic).toContain('>>> 5#');
      expect(diagnostic).toContain('    4#');
      expect(diagnostic).toContain('...'); // Between 7 and 10 (12-2)
      expect(diagnostic).toContain('>>> 12#');
    });
  });
});
