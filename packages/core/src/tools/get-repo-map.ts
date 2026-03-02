/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import {
  GET_REPO_MAP_TOOL_NAME,
  GET_REPO_MAP_DEFINITION,
} from './definitions/coreTools.js';
import type { Config } from '../config/config.js';
import { resolveToolDeclaration } from './definitions/resolver.js';

export interface GetRepoMapParams {
  query?: string;
}

class GetRepoMapInvocation extends BaseToolInvocation<
  GetRepoMapParams,
  ToolResult
> {
  constructor(
    private config: Config,
    params: GetRepoMapParams,
    messageBus: MessageBus,
  ) {
    super(params, messageBus, GET_REPO_MAP_TOOL_NAME, 'Get Repository Map');
  }

  getDescription(): string {
    return 'Generating codebase repository map...';
  }

  async execute(): Promise<ToolResult> {
    const repoMapService = this.config.getRepoMapService();
    try {
      const repoMap = await repoMapService.getRepoMap();
      return {
        llmContent: repoMap,
        returnDisplay: 'Generated repository map.',
      };
    } catch (error) {
      return {
        llmContent: `Error generating repository map: ${error instanceof Error ? error.message : String(error)}`,
        returnDisplay: 'Failed to generate repository map.',
      };
    }
  }
}

export class GetRepoMapTool extends BaseDeclarativeTool<
  GetRepoMapParams,
  ToolResult
> {
  static readonly Name = GET_REPO_MAP_TOOL_NAME;

  constructor(
    private config: Config,
    messageBus: MessageBus,
  ) {
    super(
      GetRepoMapTool.Name,
      'Get Repository Map',
      GET_REPO_MAP_DEFINITION.base.description!,
      Kind.Read,
      GET_REPO_MAP_DEFINITION.base.parametersJsonSchema,
      messageBus,
      true,
      false,
    );
  }

  protected createInvocation(
    params: GetRepoMapParams,
    messageBus: MessageBus,
  ): ToolInvocation<GetRepoMapParams, ToolResult> {
    return new GetRepoMapInvocation(this.config, params, messageBus);
  }

  override getSchema(modelId?: string) {
    return resolveToolDeclaration(GET_REPO_MAP_DEFINITION, modelId);
  }
}
