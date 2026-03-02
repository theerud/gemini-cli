/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import crypto from 'node:crypto';
import { glob } from 'glob';
import { SymbolExtractor } from './symbolExtractor.js';
import type { ExtractionResult, SymbolDefinition } from './symbolExtractor.js';
import { RepoMapCache } from './repoMapCache.js';
import type { SupportedLanguage } from './treesitterService.js';
import type { Storage } from '../config/storage.js';
import type { Config } from '../config/config.js';

export class RepoMapService {
  private extractor: SymbolExtractor;
  private cache: RepoMapCache;

  constructor(
    private config: Config,
    storage: Storage,
  ) {
    this.extractor = new SymbolExtractor();
    this.cache = new RepoMapCache(storage);
  }

  private getSupportedLanguage(filePath: string): SupportedLanguage | null {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.js':
      case '.mjs':
      case '.cjs':
        return 'javascript';
      case '.ts':
      case '.mts':
      case '.cts':
      case '.tsx':
        return 'typescript';
      case '.py':
        return 'python';
      case '.go':
        return 'go';
      case '.rs':
        return 'rust';
      case '.sh':
        return 'bash';
      default:
        return null;
    }
  }

  private async getQuerySource(
    lang: SupportedLanguage,
  ): Promise<string | null> {
    const fileName = `tree-sitter-${lang}-tags.scm`;

    // Potential locations for the queries directory
    const potentialPaths = [
      // 1. Development/Dist path (relative to this file)
      path.join(import.meta.dirname, 'queries', fileName),
      // 2. Bundled path (if running from bundle/gemini.js)
      path.join(import.meta.dirname, '..', 'bundle', 'queries', fileName),
      path.join(import.meta.dirname, '..', '..', 'bundle', 'queries', fileName),
      path.join(process.cwd(), 'bundle', 'queries', fileName),
      // 3. Absolute path from project root
      path.join(
        process.cwd(),
        'packages',
        'core',
        'dist',
        'src',
        'treesitter',
        'queries',
        fileName,
      ),
      path.join(
        process.cwd(),
        'packages',
        'core',
        'src',
        'treesitter',
        'queries',
        fileName,
      ),
    ];

    for (const queryPath of potentialPaths) {
      try {
        const content = await fs.readFile(queryPath, 'utf8');
        if (content) {
          return content;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  async getRepoMap(maxTokens: number = 4000): Promise<string> {
    await this.cache.load();
    const projectRoot = this.config.getTargetDir();

    // 1. Discover all files using glob
    const allFiles = await glob('**/*', {
      cwd: projectRoot,
      nodir: true,
      dot: true,
      ignore: this.config.getFileExclusions().getGlobExcludes(),
    });

    const supportedFiles = allFiles.filter(
      (f: string) => this.getSupportedLanguage(f) !== null,
    );

    // 2. Extract/Cache symbols with robust validation
    const projectResults: { [filePath: string]: ExtractionResult } = {};
    let cacheUpdated = false;

    for (const filePath of supportedFiles) {
      const fullPath = path.resolve(projectRoot, filePath);
      try {
        const stats = await fs.stat(fullPath);
        const mtime = stats.mtimeMs;

        // Tier 1: Quick mtime check
        const cachedByMtime = await this.cache.getEntry(filePath, mtime);
        if (cachedByMtime) {
          projectResults[filePath] = cachedByMtime.result;
          continue;
        }

        const content = await fs.readFile(fullPath, 'utf8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        // Tier 2: Robust Hash check
        const cachedByHash = await this.cache.getEntry(filePath, mtime, hash);
        if (cachedByHash) {
          await this.cache.setEntry(filePath, {
            mtime,
            hash,
            result: cachedByHash.result,
          });
          projectResults[filePath] = cachedByHash.result;
          cacheUpdated = true;
          continue;
        }

        // Tier 3: Re-parse
        const lang = this.getSupportedLanguage(filePath)!;
        const querySource = await this.getQuerySource(lang);
        if (!querySource) {
          continue;
        }

        const result = await this.extractor.extractSymbols(
          content,
          lang,
          querySource,
        );

        await this.cache.setEntry(filePath, { mtime, hash, result });
        projectResults[filePath] = result;
        cacheUpdated = true;
      } catch (_error) {
        continue;
      }
    }

    if (cacheUpdated) {
      await this.cache.saveManifest();
    }

    // 3. Build Graph & Rank (PageRank-style)
    const { nodes, edges } = this.buildGraph(projectResults);
    const ranks = this.calculatePageRank(nodes, edges);

    // 4. Generate Output String
    // Sort files by their cumulative symbol rank
    const fileRanks = Object.entries(projectResults)
      .map(([filePath, result]) => {
        const totalRank = result.definitions.reduce((sum, def) => {
          const key = `${filePath}:${def.name}`;
          return sum + (ranks[key] || 0);
        }, 0);
        return { filePath, totalRank };
      })
      .sort((a, b) => b.totalRank - a.totalRank);

    let output = 'Repository Structure (Ranked by Importance):\n\n';
    let currentTokens = 0;
    const maxTokensToUse = maxTokens;

    for (const { filePath, totalRank } of fileRanks) {
      if (currentTokens > maxTokensToUse) break;
      if (totalRank === 0 && fileRanks.length > 50) continue; // Skip unimportant files in large projects

      const result = projectResults[filePath];
      const importantDefs = result.definitions
        .sort((a, b) => {
          const rankA = ranks[`${filePath}:${a.name}`] || 0;
          const rankB = ranks[`${filePath}:${b.name}`] || 0;
          return rankB - rankA;
        })
        .slice(0, 15); // Limit symbols per file

      const fileLine = `${filePath}:\n`;
      output += fileLine;
      currentTokens += fileLine.length / 4;

      for (const def of importantDefs) {
        const kind = def.kind.split('.').pop();
        const defLine = `  ${kind} ${def.name}\n`;
        output += defLine;
        currentTokens += defLine.length / 4;
      }
      output += '\n';
    }

    return output;
  }

  private buildGraph(projectResults: {
    [filePath: string]: ExtractionResult;
  }): { nodes: string[]; edges: Array<[string, string]> } {
    const nodes: string[] = [];
    const edges: Array<[string, string]> = [];
    const symbolToNodes: { [symbolName: string]: string[] } = {};

    // First pass: Create nodes for all definitions
    for (const [filePath, result] of Object.entries(projectResults)) {
      for (const def of result.definitions) {
        const nodeKey = `${filePath}:${def.name}`;
        nodes.push(nodeKey);
        symbolToNodes[def.name] = symbolToNodes[def.name] || [];
        symbolToNodes[def.name].push(nodeKey);
      }
    }

    // Second pass: Create edges from references to definitions
    for (const [filePath, result] of Object.entries(projectResults)) {
      for (const ref of result.references) {
        const targetNodes = symbolToNodes[ref.name];
        if (targetNodes) {
          for (const targetNode of targetNodes) {
            // Edge from referencing file's "context" to the definition
            // To simplify, we just use a virtual "file node" or link all definitions in this file
            for (const localDef of result.definitions) {
              const sourceNode = `${filePath}:${localDef.name}`;
              edges.push([sourceNode, targetNode]);
            }
          }
        }
      }
    }

    return { nodes, edges };
  }

  private calculatePageRank(
    nodes: string[],
    edges: Array<[string, string]>,
    iterations: number = 20,
    damping: number = 0.85,
  ): { [node: string]: number } {
    if (nodes.length === 0) return {};

    const ranks: { [node: string]: number } = {};
    const initialRank = 1 / nodes.length;
    nodes.forEach((node) => (ranks[node] = initialRank));

    const outDegree: { [node: string]: number } = {};
    const inEdges: { [node: string]: string[] } = {};
    nodes.forEach((node) => {
      outDegree[node] = 0;
      inEdges[node] = [];
    });

    edges.forEach(([src, dst]) => {
      outDegree[src]++;
      inEdges[dst].push(src);
    });

    for (let i = 0; i < iterations; i++) {
      const nextRanks: { [node: string]: number } = {};
      let totalDanglingRank = 0;

      nodes.forEach((node) => {
        if (outDegree[node] === 0) {
          totalDanglingRank += ranks[node];
        }
      });

      nodes.forEach((node) => {
        let rankSum = 0;
        inEdges[node].forEach((src) => {
          rankSum += ranks[src] / outDegree[src];
        });

        nextRanks[node] =
          (1 - damping) / nodes.length +
          damping * (rankSum + totalDanglingRank / nodes.length);
      });

      Object.assign(ranks, nextRanks);
    }

    return ranks;
  }

  async listSymbols(filePath: string): Promise<SymbolDefinition[]> {
    await this.cache.load();
    const fullPath = path.resolve(this.config.getTargetDir(), filePath);
    const stats = await fs.stat(fullPath);
    const mtime = stats.mtimeMs;

    // Fast check
    const cachedByMtime = await this.cache.getEntry(filePath, mtime);
    if (cachedByMtime) return cachedByMtime.result.definitions;

    const content = await fs.readFile(fullPath, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    // Hash check
    const cachedByHash = await this.cache.getEntry(filePath, mtime, hash);
    if (cachedByHash) {
      await this.cache.setEntry(filePath, {
        mtime,
        hash,
        result: cachedByHash.result,
      });
      return cachedByHash.result.definitions;
    }

    const lang = this.getSupportedLanguage(filePath);
    if (!lang) return [];

    const querySource = await this.getQuerySource(lang);
    if (!querySource) return [];

    const result = await this.extractor.extractSymbols(
      content,
      lang,
      querySource,
    );
    await this.cache.setEntry(filePath, { mtime, hash, result });
    await this.cache.saveManifest();
    return result.definitions;
  }
}
