/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect } from 'vitest';
import { evalTest } from './test-helper.js';

const REPETITIVE_FILE = `
export function item() { return "value"; }
export function item() { return "value"; }
export function item() { return "value"; }
export function item() { return "value"; }
export function item() { return "value"; }
export function item() { return "value"; }
export function item() { return "value"; }
export function item() { return "value"; }
export function item() { return "value"; }
export function item() { return "TARGET_LINE"; }
export function item() { return "value"; }
export function item() { return "value"; }
export function item() { return "value"; }
`.trim();

describe('Hashline Protocol Evaluation', () => {
  /**
   * CASE 1: Hashline Efficiency
   * Measures token usage when using line_edits vs traditional matching.
   */
  evalTest('USUALLY_PASSES', {
    name: 'Hashline Efficiency - should use precise line_edits',
    params: {
      settings: {
        experimental: { enableHashline: true },
      },
    },
    files: {
      'src/efficiency.ts': REPETITIVE_FILE,
    },
    prompt:
      'Read src/efficiency.ts with hashline identifiers, then change "TARGET_LINE" to "SUCCESS" using the hashline ID.',
    timeout: 180000,
    assert: async (rig) => {
      const toolLogs = rig.readToolLogs();
      const replaceCall = toolLogs.find(
        (t) => t.toolRequest.name === 'replace',
      );
      expect(replaceCall, 'Model should have called replace').toBeTruthy();
      const args = JSON.parse(replaceCall!.toolRequest.args);
      expect(
        args.line_edits,
        'Model should have used line_edits parameter',
      ).toBeDefined();
      expect(args.line_edits.length).toBe(1);
      const content = rig.readFile('src/efficiency.ts');
      expect(content).toContain('SUCCESS');
    },
  });

  /**
   * CASE 2: Hashline Robustness (Ambiguity)
   * Tests targeting a specific instance among many identical ones.
   */
  evalTest('USUALLY_PASSES', {
    name: 'Hashline Robustness - should target correct repetitive line',
    params: {
      settings: {
        experimental: { enableHashline: true },
      },
    },
    files: {
      'src/repetitive.ts': 'return "value";\nreturn "value";\nreturn "value";',
    },
    prompt:
      'Read src/repetitive.ts with hashes. Change ONLY the SECOND line to return "middle".',
    timeout: 180000,
    assert: async (rig) => {
      const content = rig.readFile('src/repetitive.ts');
      const lines = content.split('\n');
      expect(lines[1]).toBe('return "middle";');
      expect(lines[0]).toBe('return "value";');
      expect(lines[2]).toBe('return "value";');
    },
  });

  /**
   * CASE 3: Comparative Baseline (Non-Hashline)
   * Measures behavior on the same repetitive task WITHOUT hashline.
   */
  evalTest('USUALLY_PASSES', {
    name: 'Hashline Baseline - behavior without hashline',
    params: {
      settings: {
        experimental: { enableHashline: false },
      },
    },
    files: {
      'src/baseline.ts': 'return "value";\nreturn "value";\nreturn "value";',
    },
    prompt:
      'Change ONLY the SECOND line of src/baseline.ts to return "middle".',
    timeout: 180000,
    assert: async (rig) => {
      // In baseline mode, the model often struggles with this or uses massive context.
      const content = rig.readFile('src/baseline.ts');
      // We don't strictly expect failure here, but we established the baseline.
      expect(content).toContain('middle');
    },
  });
});
