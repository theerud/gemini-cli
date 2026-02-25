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
  });
});
