/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, describe, it, vi, beforeEach } from 'vitest';
import { RepoMapService } from './repoMapService.js';
import type { Config } from '../config/config.js';
import type { Storage } from '../config/storage.js';

describe('RepoMapService', () => {
  let service: RepoMapService;
  let mockConfig: unknown;
  let mockStorage: unknown;

  beforeEach(() => {
    mockConfig = {
      getTargetDir: vi.fn().mockReturnValue('/mock/project'),
      getFileExclusions: vi.fn().mockReturnValue({ getGlobExcludes: () => [] }),
    };
    mockStorage = {
      getProjectTempDir: vi.fn().mockReturnValue('/tmp/mock-project'),
    };
    service = new RepoMapService(mockConfig as Config, mockStorage as Storage);
  });

  describe('PageRank calculation', () => {
    it('should rank a heavily referenced symbol higher', () => {
      const nodes = ['fileA:ClassA', 'fileB:funcB'];
      const edges: Array<[string, string]> = [
        ['fileB:funcB', 'fileA:ClassA'], // B references A
      ];

      // @ts-expect-error - Accessing private method for testing
      const ranks = service.calculatePageRank(nodes, edges);

      // ClassA should have a higher rank because it is referenced by funcB
      expect(ranks['fileA:ClassA']).toBeGreaterThan(ranks['fileB:funcB']);
    });

    it('should handle circular references gracefully', () => {
      const nodes = ['A:sA', 'B:sB'];
      const edges: Array<[string, string]> = [
        ['A:sA', 'B:sB'],
        ['B:sB', 'A:sA'],
      ];

      // @ts-expect-error - Accessing private method for testing
      const ranks = service.calculatePageRank(nodes, edges);

      // In a perfectly balanced circle, ranks should be identical
      expect(ranks['A:sA']).toBeCloseTo(ranks['B:sB']);
    });

    it('should handle dangling nodes (no outgoing edges)', () => {
      const nodes = ['A', 'B', 'C'];
      const edges: Array<[string, string]> = [
        ['A', 'B'], // A -> B
        // B and C are dangling
      ];

      // @ts-expect-error - Accessing private method for testing
      const ranks = service.calculatePageRank(nodes, edges);

      expect(ranks['B']).toBeGreaterThan(0);
      expect(ranks['C']).toBeGreaterThan(0);
    });
  });

  describe('Graph building', () => {
    it('should create edges from references to definitions', () => {
      const projectResults = {
        'fileA.ts': {
          definitions: [
            {
              name: 'ClassA',
              kind: 'definition.class',
              range: {
                start: { line: 0, column: 0 },
                end: { line: 1, column: 0 },
              },
            },
          ],
          references: [],
        },
        'fileB.ts': {
          definitions: [
            {
              name: 'funcB',
              kind: 'definition.function',
              range: {
                start: { line: 0, column: 0 },
                end: { line: 1, column: 0 },
              },
            },
          ],
          references: [
            {
              name: 'ClassA',
              range: {
                start: { line: 2, column: 0 },
                end: { line: 2, column: 5 },
              },
            },
          ],
        },
      };

      // @ts-expect-error - Accessing private method for testing
      const { nodes, edges } = service.buildGraph(projectResults);

      expect(nodes).toContain('fileA.ts:ClassA');
      expect(nodes).toContain('fileB.ts:funcB');

      // There should be an edge from the caller (fileB:funcB) to the definition (fileA:ClassA)
      expect(edges).toContainEqual(['fileB.ts:funcB', 'fileA.ts:ClassA']);
    });
  });
});
