/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApprovalMode } from '../policy/types.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import { EXIT_PLAN_MODE_TOOL_NAME } from './tool-names.js';
import type { Config } from '../config/config.js';

export interface ExitPlanModeToolParams {
  plan: string;
}

class ExitPlanModeToolInvocation extends BaseToolInvocation<
  ExitPlanModeToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: ExitPlanModeToolParams,
    messageBus?: MessageBus,
    toolName?: string,
    toolDisplayName?: string,
  ) {
    super(params, messageBus, toolName, toolDisplayName);
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    this.config.setApprovalMode(ApprovalMode.DEFAULT);
    return {
      llmContent: `Exited plan mode. The plan has been presented to the user.`,
      returnDisplay: `Exited plan mode.`,
    };
  }
}

export class ExitPlanModeTool extends BaseDeclarativeTool<
  ExitPlanModeToolParams,
  ToolResult
> {
  static readonly Name = EXIT_PLAN_MODE_TOOL_NAME;

  constructor(
    private readonly config: Config,
    messageBus?: MessageBus,
  ) {
    super(
      ExitPlanModeTool.Name,
      'ExitPlanMode',
      "Exit planning mode after creating implementation plan. Use this tool when you are in plan mode and have finished presenting your plan and are ready to code. This will prompt the user to exit plan mode. IMPORTANT: Only use this tool when the task requires planning the implementation steps of a task that requires writing code. For research tasks where you're gathering information, searching files, reading files or in general trying to understand the codebase - do NOT use this tool. Handling Ambiguity in Plans: Before using this tool, ensure your plan is clear and unambiguous. If there are multiple valid approaches or unclear requirements: 1. Use the AskUserQuestion tool to clarify with the user 2. Ask about specific implementation choices (e.g., architectural patterns, which library to use) 3. Clarify any assumptions that could affect the implementation 4. Only proceed with ExitPlanMode after resolving ambiguities.",
      Kind.Other,
      {
        type: 'object',
        required: ['plan'],
        additionalProperties: false,
        properties: {
          plan: {
            type: 'string',
            description:
              'The plan you came up with, that you want to run by the user for approval. Supports markdown. The plan should be pretty concise.',
          },
        },
      },
      undefined,
      undefined,
      messageBus,
    );
  }

  protected createInvocation(
    params: ExitPlanModeToolParams,
    messageBus?: MessageBus,
    toolName?: string,
    displayName?: string,
  ): ToolInvocation<ExitPlanModeToolParams, ToolResult> {
    return new ExitPlanModeToolInvocation(
      this.config,
      params,
      messageBus ?? this.messageBus,
      toolName ?? this.name,
      displayName ?? this.displayName,
    );
  }
}
