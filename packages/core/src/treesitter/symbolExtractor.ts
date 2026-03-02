/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Query } from 'web-tree-sitter';
import { TreeSitterService } from './treesitterService.js';
import type { SupportedLanguage } from './treesitterService.js';

export interface SymbolDefinition {
  name: string;
  kind: string;
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface SymbolReference {
  name: string;
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface ExtractionResult {
  definitions: SymbolDefinition[];
  references: SymbolReference[];
}

export class SymbolExtractor {
  private treesitterService: TreeSitterService;

  constructor() {
    this.treesitterService = TreeSitterService.getInstance();
  }

  async extractSymbols(
    content: string,
    lang: SupportedLanguage,
    querySource: string,
  ): Promise<ExtractionResult> {
    const parser = await this.treesitterService.getParserForLanguage(lang);
    const language = await this.treesitterService.getLanguage(lang);

    const tree = parser.parse(content);
    if (!tree) {
      throw new Error(`Failed to parse content for ${lang}`);
    }
    let query: Query | null = null;

    try {
      query = new Query(language, querySource);
      const captures = query.captures(tree.rootNode);

      const definitions: SymbolDefinition[] = [];
      const references: SymbolReference[] = [];

      // Map captures to definitions and references
      // This logic depends on the structure of tags.scm (Aider style)
      // Usually captures like @definition.function, @reference.call etc.

      for (const capture of captures) {
        const name = capture.node.text;
        const kind = capture.name; // e.g., 'name.definition.function'
        const range = {
          start: {
            line: capture.node.startPosition.row,
            column: capture.node.startPosition.column,
          },
          end: {
            line: capture.node.endPosition.row,
            column: capture.node.endPosition.column,
          },
        };

        if (kind.includes('definition')) {
          definitions.push({ name, kind, range });
        } else if (kind.includes('reference')) {
          references.push({ name, range });
        }
      }

      return { definitions, references };
    } finally {
      if (query) query.delete();
      if (tree) tree.delete();
    }
  }
}
