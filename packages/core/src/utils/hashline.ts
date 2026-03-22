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
  // Normalize: remove all whitespace to be robust against formatting changes.
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
 * Details of a Hashline mismatch during verification.
 */
export interface HashMismatch {
  /** The 1-based line number. */
  line: number;
  /** The Hashline identifier expected by the model. */
  expected: string;
  /** The actual Hashline identifier generated from current content. */
  actual: string;
}

/**
 * Error thrown when Hashline verification fails.
 */
export class HashlineMismatchError extends Error {
  constructor(
    readonly mismatches: HashMismatch[],
    message = 'Hashline mismatch detected',
  ) {
    super(message);
    this.name = 'HashlineMismatchError';
  }
}

/**
 * Formats a recovery diagnostic for Hashline mismatches.
 *
 * Provides a "Recovery Snippet" with:
 * - Context lines (2-3 lines above/below).
 * - `>>>` prefix on the lines that failed.
 * - The *actual* current `LINE#ID: content` format to help the model self-correct.
 *
 * @param mismatches The detected mismatches.
 * @param lines The raw lines of the file.
 * @returns A formatted diagnostic string.
 */
export function formatMismatchDiagnostic(
  mismatches: HashMismatch[],
  lines: string[],
): string {
  const hashes = generateFileHashes(lines.join('\n'));
  const diagnosticLines: string[] = [];

  // Sort mismatches by line number to ensure logical context grouping
  const sortedMismatches = [...mismatches].sort((a, b) => a.line - b.line);

  let lastReportedLine = 0;

  for (const mismatch of sortedMismatches) {
    const start = Math.max(1, mismatch.line - 2);
    const end = Math.min(lines.length, mismatch.line + 2);

    // Add separator if there is a gap between reported contexts
    if (lastReportedLine > 0 && start > lastReportedLine + 1) {
      diagnosticLines.push('...');
    } else if (lastReportedLine > 0 && start <= lastReportedLine) {
      // Overlapping or adjacent, skip starting from where we left off
      // But we need to handle the case where the current mismatch is already within reported range
      if (mismatch.line <= lastReportedLine) continue;
    }

    for (let i = Math.max(start, lastReportedLine + 1); i <= end; i++) {
      const lineContent = lines[i - 1];
      const actualHash = hashes[i - 1];
      const formatted = formatHashline(i, actualHash, lineContent);
      const isMismatchLine = mismatches.some((m) => m.line === i);

      if (isMismatchLine) {
        diagnosticLines.push(`>>> ${formatted}`);
      } else {
        diagnosticLines.push(`    ${formatted}`);
      }
    }
    lastReportedLine = end;
  }

  return [
    'HASHLINE MISMATCH DETECTED',
    'The content of the file has changed. Use the actual Hashline identifiers below to recover:',
    '',
    ...diagnosticLines,
  ].join('\n');
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
