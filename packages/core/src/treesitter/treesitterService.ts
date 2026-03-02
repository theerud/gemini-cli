/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Language, Parser } from 'web-tree-sitter';
import { loadWasmBinary } from '../utils/fileUtils.js';
import { debugLogger } from '../utils/debugLogger.js';

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'rust'
  | 'bash';

export class TreeSitterService {
  private static instance: TreeSitterService;
  private languages: Map<SupportedLanguage, Language> = new Map();
  private parser: Parser | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): TreeSitterService {
    if (!TreeSitterService.instance) {
      TreeSitterService.instance = new TreeSitterService();
    }
    return TreeSitterService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const treeSitterBinary = await loadWasmBinary(
          () =>
            // @ts-expect-error resolved by esbuild-plugin-wasm during bundling
            import('web-tree-sitter/tree-sitter.wasm?binary'),
          'web-tree-sitter/tree-sitter.wasm',
        );
        await Parser.init({ wasmBinary: treeSitterBinary });
        this.parser = new Parser();
      } catch (error) {
        debugLogger.error('Failed to initialize Tree-sitter Parser:', error);
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  async getLanguage(lang: SupportedLanguage): Promise<Language> {
    const existing = this.languages.get(lang);
    if (existing) {
      return existing;
    }

    await this.initialize();

    try {
      let binary: Uint8Array;
      switch (lang) {
        case 'javascript':
          binary = await loadWasmBinary(
            () =>
              // @ts-expect-error - Dynamic import with wasm?binary is handled by esbuild plugin
              import(
                'tree-sitter-javascript/tree-sitter-javascript.wasm?binary'
              ),
            'tree-sitter-javascript/tree-sitter-javascript.wasm',
          );
          break;
        case 'typescript':
          binary = await loadWasmBinary(
            () =>
              // @ts-expect-error - Dynamic import with wasm?binary is handled by esbuild plugin
              import(
                'tree-sitter-typescript/tree-sitter-typescript.wasm?binary'
              ),
            'tree-sitter-typescript/tree-sitter-typescript.wasm',
          );
          break;
        case 'python':
          binary = await loadWasmBinary(
            () =>
              // @ts-expect-error - Dynamic import with wasm?binary is handled by esbuild plugin
              import('tree-sitter-python/tree-sitter-python.wasm?binary'),
            'tree-sitter-python/tree-sitter-python.wasm',
          );
          break;
        case 'go':
          binary = await loadWasmBinary(
            () =>
              // @ts-expect-error - Dynamic import with wasm?binary is handled by esbuild plugin
              import('tree-sitter-go/tree-sitter-go.wasm?binary'),
            'tree-sitter-go/tree-sitter-go.wasm',
          );
          break;
        case 'rust':
          binary = await loadWasmBinary(
            () =>
              // @ts-expect-error - Dynamic import with wasm?binary is handled by esbuild plugin
              import('tree-sitter-rust/tree-sitter-rust.wasm?binary'),
            'tree-sitter-rust/tree-sitter-rust.wasm',
          );
          break;
        case 'bash':
          binary = await loadWasmBinary(
            () =>
              // @ts-expect-error - Dynamic import with wasm?binary is handled by esbuild plugin
              import('tree-sitter-bash/tree-sitter-bash.wasm?binary'),
            'tree-sitter-bash/tree-sitter-bash.wasm',
          );
          break;
        default:
          throw new Error(`Unsupported language: ${lang}`);
      }

      const language = await Language.load(binary);
      this.languages.set(lang, language);
      return language;
    } catch (error) {
      debugLogger.error(`Failed to load Tree-sitter language ${lang}:`, error);
      throw error;
    }
  }

  async getParserForLanguage(lang: SupportedLanguage): Promise<Parser> {
    const language = await this.getLanguage(lang);
    if (!this.parser) {
      await this.initialize();
    }
    this.parser!.setLanguage(language);
    return this.parser!;
  }
}
