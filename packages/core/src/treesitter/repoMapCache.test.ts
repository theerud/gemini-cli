/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, describe, it, vi, beforeEach } from 'vitest';
import { RepoMapCache } from './repoMapCache.js';
import type { Storage } from '../config/storage.js';
import * as fs from 'node:fs/promises';

vi.mock('node:fs/promises');

describe('RepoMapCache', () => {
  let cache: RepoMapCache;
  let mockStorage: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {
      getProjectTempDir: vi.fn().mockReturnValue('/tmp/mock-project'),
    };
    cache = new RepoMapCache(mockStorage as Storage);
  });

  it('should load manifest if it exists', async () => {
    const mockManifest = {
      'file.ts': { mtime: 100, hash: 'h1', cacheFile: 'shard1.json' },
    };
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockManifest));

    await cache.load();

    // @ts-expect-error - Accessing private manifest for testing
    expect(cache.manifest['file.ts']).toBeDefined();
  });

  it('should return undefined if mtime mismatch (Tier 1)', async () => {
    const mockManifest = {
      'file.ts': { mtime: 100, hash: 'h1', cacheFile: 'shard1.json' },
    };
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockManifest));

    // Entry has mtime 100, we ask for 200
    const entry = await cache.getEntry('file.ts', 200);
    expect(entry).toBeUndefined();
  });

  it('should return undefined if hash mismatch (Tier 2)', async () => {
    const mockManifest = {
      'file.ts': { mtime: 100, hash: 'old-hash', cacheFile: 'shard1.json' },
    };
    vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockManifest));

    // mtime matches (100), but content hash is different
    const entry = await cache.getEntry('file.ts', 100, 'new-hash');
    expect(entry).toBeUndefined();
  });

  it('should load from shard if manifest validation passes', async () => {
    const mockManifest = {
      'file.ts': { mtime: 100, hash: 'h1', cacheFile: 'shard1.json' },
    };
    const mockShardContent = {
      mtime: 100,
      hash: 'h1',
      result: { definitions: [{ name: 'Foo' }], references: [] },
    };

    vi.mocked(fs.readFile)
      .mockResolvedValueOnce(JSON.stringify(mockManifest))
      .mockResolvedValueOnce(JSON.stringify(mockShardContent));

    const entry = await cache.getEntry('file.ts', 100, 'h1');

    expect(entry).toBeDefined();
    // @ts-expect-error - Result structure mismatch in simple mock
    expect(entry?.result.definitions[0].name).toBe('Foo');
  });
});
