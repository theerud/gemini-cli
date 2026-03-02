/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import crypto from 'node:crypto';
import type { ExtractionResult } from './symbolExtractor.js';
import type { Storage } from '../config/storage.js';

export interface FileCacheEntry {
  mtime: number;
  hash: string;
  result: ExtractionResult;
}

export interface ManifestEntry {
  mtime: number;
  hash: string;
  cacheFile: string;
}

/**
 * Sharded cache for RepoMap data.
 * Stores individual file symbols in separate JSON files to avoid monolithic write overhead.
 * Uses mtime + content hash for robust invalidation.
 */
export class RepoMapCache {
  private cacheDir: string;
  private manifestPath: string;
  private manifest: { [filePath: string]: ManifestEntry } = {};
  private inMemoryCache: { [filePath: string]: FileCacheEntry } = {};
  private manifestLoaded = false;

  constructor(storage: Storage) {
    const projectTempDir = storage.getProjectTempDir();
    this.cacheDir = path.join(projectTempDir, 'repo_map');
    this.manifestPath = path.join(this.cacheDir, 'manifest.json');
  }

  async load(): Promise<void> {
    if (this.manifestLoaded) return;
    try {
      const content = await fs.readFile(this.manifestPath, 'utf8');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      this.manifest = JSON.parse(content) as Record<string, ManifestEntry>;
      this.manifestLoaded = true;
    } catch {
      this.manifest = {};
      this.manifestLoaded = true;
    }
  }

  private getShardFileName(filePath: string): string {
    // Shard by hashing the path to get a unique, safe filename
    return crypto.createHash('sha256').update(filePath).digest('hex') + '.json';
  }

  /**
   * Retrieves a cache entry if it matches the current mtime and hash.
   */
  async getEntry(
    filePath: string,
    mtime: number,
    hash?: string,
  ): Promise<FileCacheEntry | undefined> {
    await this.load();

    // 1. Check in-memory cache first (hottest path)
    const mem = this.inMemoryCache[filePath];
    if (mem && mem.mtime === mtime && (!hash || mem.hash === hash)) {
      return mem;
    }

    // 2. Check manifest validation
    const entryInfo = this.manifest[filePath];
    if (!entryInfo || entryInfo.mtime !== mtime) {
      return undefined;
    }

    // If hash provided, it must match
    if (hash && entryInfo.hash !== hash) {
      return undefined;
    }

    // 3. Load from disk shard
    try {
      const shardPath = path.join(this.cacheDir, entryInfo.cacheFile);
      const content = await fs.readFile(shardPath, 'utf8');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const entry = JSON.parse(content) as unknown as FileCacheEntry;

      // Update memory cache
      this.inMemoryCache[filePath] = entry;
      return entry;
    } catch {
      return undefined;
    }
  }

  /**
   * Saves an entry to a shard and updates the manifest.
   */
  async setEntry(
    filePath: string,
    entry: FileCacheEntry,
  ): Promise<void> {
    this.inMemoryCache[filePath] = entry;

    const cacheFile = this.getShardFileName(filePath);
    this.manifest[filePath] = {
      mtime: entry.mtime,
      hash: entry.hash,
      cacheFile,
    };

    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const shardPath = path.join(this.cacheDir, cacheFile);
      await fs.writeFile(shardPath, JSON.stringify(entry));
    } catch {
      // Non-critical if cache write fails
    }
  }

  /**
   * Persists the manifest to disk. Should be called at the end of an update cycle.
   */
  async saveManifest(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.writeFile(
        this.manifestPath,
        JSON.stringify(this.manifest, null, 2),
      );
    } catch {
      // Non-critical
    }
  }

  /**
   * Returns all known file paths in the manifest.
   */
  getCachedFiles(): string[] {
    return Object.keys(this.manifest);
  }
}
