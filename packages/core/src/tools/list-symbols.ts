/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import {
  LIST_SYMBOLS_TOOL_NAME,
  LIST_SYMBOLS_DEFINITION,
  PARAM_FILE_PATH,
} from './definitions/coreTools.js';
import type { Config } from '../config/config.js';
import { resolveToolDeclaration } from './definitions/resolver.js';

export interface ListSymbolsParams {
  [PARAM_FILE_PATH]: string;
}

class ListSymbolsInvocation extends BaseToolInvocation<
  ListSymbolsParams,
  ToolResult
> {
  constructor(
    private config: Config,
    params: ListSymbolsParams,
    messageBus: MessageBus,
  ) {
    super(params, messageBus, LIST_SYMBOLS_TOOL_NAME, 'List Symbols');
  }

  getDescription(): string {
    return `Listing symbols in ${this.params[PARAM_FILE_PATH]}...`;
  }

  async execute(): Promise<ToolResult> {
    const repoMapService = this.config.getRepoMapService();
    try {
      const symbols = await repoMapService.listSymbols(
        this.params[PARAM_FILE_PATH],
      );
      const formattedSymbols = symbols
        .map(
          (s) =>
            `[${s.range.start.line + 1}] ${s.kind.replace('definition.', '')} ${s.name}`,
        )
        .join('\n');

      return {
        llmContent: formattedSymbols || 'No symbols found in this file.',
        returnDisplay: `Found ${symbols.length} symbols in ${this.params[PARAM_FILE_PATH]}.`,
      };
    } catch (error) {
      return {
        llmContent: `Error listing symbols: ${error instanceof Error ? error.message : String(error)}`,
        returnDisplay: 'Failed to list symbols.',
      };
    }
  }
}

export class ListSymbolsTool extends BaseDeclarativeTool<
  ListSymbolsParams,
  ToolResult
> {
  static readonly Name = LIST_SYMBOLS_TOOL_NAME;

  constructor(
    private config: Config,
    messageBus: MessageBus,
  ) {
    super(
      ListSymbolsTool.Name,
      'List Symbols',
      LIST_SYMBOLS_DEFINITION.base.description!,
      Kind.Read,
      LIST_SYMBOLS_DEFINITION.base.parametersJsonSchema,
      messageBus,
      true,
      false,
    );
  }

  protected createInvocation(
    params: ListSymbolsParams,
    messageBus: MessageBus,
  ): ToolInvocation<ListSymbolsParams, ToolResult> {
    return new ListSymbolsInvocation(this.config, params, messageBus);
  }

  override getSchema(modelId?: string) {
    return resolveToolDeclaration(LIST_SYMBOLS_DEFINITION, modelId);
  }
}
