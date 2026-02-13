/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';

/**
 * Regex to match hashline prefixes like "12:a1|"
 * Capture group 1: Line number
 * Capture group 2: 2-character hash
 */
export const HASHLINE_REGEX = /^(\d+):([0-9a-z]{2})\|/;

/**
 * Computes a 2-character base36 hash for a line of code.
 * Robust against whitespace changes by trimming all whitespace before hashing.
 *
 * @param line The line content to hash.
 * @returns A 2-character base36 string.
 */
export function computeLineHash(line: string): string {
  const normalized = line.trim().replace(/\s+/g, '');
  if (normalized === '') {
    return '00';
  }

  // Use SHAKE256 to get exactly 1 byte (8 bits)
  // 8 bits gives 256 possible values, which fits well into 2 base36 chars (1296 possible values)
  const hash = crypto.createHash('shake256', { outputLength: 1 });
  hash.update(normalized);
  const buffer = hash.digest();

  // Convert to base36 and pad to 2 characters
  return buffer[0].toString(36).padStart(2, '0');
}

/**
 * Formats a line with a hashline prefix.
 */
export function formatHashline(line: string, lineNum: number): string {
  const hash = computeLineHash(line);
  return `${lineNum}:${hash}|${line}`;
}

/**
 * Strips the hashline prefix from a line if present.
 */
export function stripHashline(line: string): string {
  return line.replace(HASHLINE_REGEX, '');
}

/**
 * Parses a prefixed hashline to extract line number and hash.
 */
export function parseHashline(
  line: string,
): { lineNum: number; hash: string; content: string } | null {
  const match = line.match(HASHLINE_REGEX);
  if (!match) {
    return null;
  }

  return {
    lineNum: parseInt(match[1], 10),
    hash: match[2],
    content: line.substring(match[0].length),
  };
}
