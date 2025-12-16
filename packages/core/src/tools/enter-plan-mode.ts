/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApprovalMode } from '../policy/types.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import { ENTER_PLAN_MODE_TOOL_NAME } from './tool-names.js';
import type { Config } from '../config/config.js';

export interface EnterPlanModeToolParams {
  rationale: string;
}

class EnterPlanModeToolInvocation extends BaseToolInvocation<
  EnterPlanModeToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: EnterPlanModeToolParams,
    messageBus?: MessageBus,
    toolName?: string,
    toolDisplayName?: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    if (this.config.getApprovalMode() === ApprovalMode.PLAN_MODE) {
      return {
        llmContent: `Already in Plan Mode.`,
        returnDisplay: `Already in Plan Mode.`,
      };
    }
    await this.config.setApprovalMode(ApprovalMode.PLAN_MODE);
    return {
      llmContent: `Entered Plan Mode. Rationale: ${this.params.rationale}`,
      returnDisplay: `Entered Plan Mode.`,
    };
  }

  getDescription(): string {
    return 'Entering plan mode';
  }
}

export class EnterPlanModeTool extends BaseDeclarativeTool<
  EnterPlanModeToolParams,
  ToolResult
> {
  static readonly Name = ENTER_PLAN_MODE_TOOL_NAME;

  constructor(
    private readonly config: Config,
    messageBus?: MessageBus,
  ) {
    super(
      EnterPlanModeTool.Name,
      'EnterPlanMode',
      'Switch to Plan Mode. Use this when the user wants to discuss, brainstorm, or plan before implementation, or when you need to work out complex details/decisions with the user. This restricts you to read-only tools. Do NOT use this tool if you are already in Plan Mode.',
      Kind.Other,
      {
        type: 'object',
        required: ['rationale'],
        additionalProperties: false,
        properties: {
          rationale: {
            type: 'string',
            description:
              'The reason for entering Plan Mode (e.g., "The user asked to discuss architectural trade-offs").',
          },
        },
      },
      undefined,
      undefined,
      messageBus,
    );
  }

  protected createInvocation(
    params: EnterPlanModeToolParams,
    messageBus?: MessageBus,
    toolName?: string,
    displayName?: string,
  ): ToolInvocation<EnterPlanModeToolParams, ToolResult> {
    return new EnterPlanModeToolInvocation(
      this.config,
      params,
      messageBus ?? this.messageBus,
      toolName ?? this.name,
      displayName ?? this.displayName,
    );
  }
}
