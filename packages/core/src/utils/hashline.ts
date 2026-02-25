/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as crypto from 'node:crypto';

/**
 * Alphabet for hash generation.
 * Avoids visually similar characters (I, O, 0, 1) to reduce model confusion.
 */
const HASH_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ALPHABET_BASE = HASH_ALPHABET.length;

/**
 * Generates a short, content-anchored hash for a line.
 *
 * @param content The raw content of the line.
 * @param index The 1-based index of the line.
 * @param contextHash A stable hash from a previous line to anchor symbolic lines (braces, empty lines).
 * @returns A 3-character hash string.
 */
export function generateHash(
  content: string,
  index: number,
  contextHash?: string,
): string {
  // Normalize: strip all whitespace to be robust against formatting drift.
  const normalized = content.replace(/\s/g, '');

  // If the line contains no alphanumeric characters (symbols, braces, empty),
  // it is "symbolic" and needs external context to be unique.
  const isSymbolic = normalized.length === 0 || !/[a-zA-Z0-9]/.test(normalized);

  let seed = normalized;
  if (isSymbolic) {
    if (contextHash) {
      seed += `:${contextHash}`;
    } else {
      // If no block context is available, fallback to index-based seeding.
      // This is less stable but ensures uniqueness for empty lines at the top of a file.
      seed += `:line_${index}`;
    }
  }

  const hashBuffer = crypto.createHash('sha256').update(seed).digest();

  // Use first 3 bytes to generate a 3-character ID.
  // UInt24 max is 16,777,215. 32^3 is 32,768.
  // We have plenty of entropy for 3 characters.
  let val = hashBuffer.readUIntBE(0, 3);
  let result = '';
  for (let i = 0; i < 3; i++) {
    result += HASH_ALPHABET[val % ALPHABET_BASE];
    val = Math.floor(val / ALPHABET_BASE);
  }
  return result;
}

/**
 * Formats a line with its Hashline identifier.
 */
export function formatHashline(
  index: number,
  hash: string,
  content: string,
): string {
  return `${index}#${hash}:${content}`;
}

/**
 * Parses a Hashline-formatted line.
 * Expected format: [INDEX]#[HASH]:[CONTENT]
 */
export function parseHashline(line: string): {
  index: number;
  hash: string;
  content: string;
} | null {
  const match = line.match(/^(\d+)#([A-Z2-9]{3}):(.*)$/);
  if (!match) return null;

  return {
    index: parseInt(match[1], 10),
    hash: match[2],
    content: match[3],
  };
}

/**
 * Generates hashes for a whole file, returning an array of hashes.
 * Implements the "Block Context" strategy: symbolic lines are seeded with
 * the hash of the nearest preceding non-symbolic line.
 */
export function generateFileHashes(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const hashes: string[] = [];
  let lastStableHash: string | undefined;

  lines.forEach((line, i) => {
    const index = i + 1;
    const hash = generateHash(line, index, lastStableHash);
    hashes.push(hash);

    // Update stable context if this line is alphanumeric
    if (/[a-zA-Z0-9]/.test(line.replace(/\s/g, ''))) {
      lastStableHash = hash;
    }
  });

  return hashes;
}

/**
 * Annotates file content with Hashline identifiers.
 */
export function annotateContent(content: string): string {
  const lines = content.split(/\r?\n/);
  const hashes = generateFileHashes(content);

  return lines
    .map((line, i) => formatHashline(i + 1, hashes[i], line))
    .join('\n');
}
