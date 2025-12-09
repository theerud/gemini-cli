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

  getDescription(): string {
    return 'Exiting plan mode';
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
      "Exit planning mode. ONLY use this tool AFTER you have presented the plan to the user AND received their explicit confirmation to proceed. Do NOT use this tool to present the plan. You must iterate on the plan using normal chat or the AskUserQuestion tool first. IMPORTANT: Only use this tool when the task requires planning the implementation steps of a task that requires writing code. For research tasks where you're gathering information, searching files, reading files or in general trying to understand the codebase - do NOT use this tool.",
      Kind.Other,
      {
        type: 'object',
        required: ['plan'],
        additionalProperties: false,
        properties: {
          plan: {
            type: 'string',
            description:
              'The final, user-approved plan. This serves as a confirmation of the work to be done. Supports markdown. The plan should be concise.',
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
