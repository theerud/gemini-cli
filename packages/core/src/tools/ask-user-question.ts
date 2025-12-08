/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ASK_USER_QUESTION_TOOL_NAME } from './tool-names.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  ToolConfirmationOutcome,
  type ToolResult,
  type ToolInvocation,
  type ToolAskUserQuestionDetails,
  type ToolAskUserQuestionPayload,
  type Question,
} from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import { safeJsonStringify } from '../utils/safeJsonStringify.js';

export interface AskUserQuestionParams {
  questions: Question[];
  // answers may be present if the model tries to hallucinate them or if we use this type for result too,
  // but we primarily care about questions here.
  answers?: Record<string, string>;
}

export class AskUserQuestionInvocation extends BaseToolInvocation<
  AskUserQuestionParams,
  ToolResult
> {
  private answers: Record<string, string> = {};

  getDescription(): string {
    return `Ask user ${this.params.questions.length} question(s)`;
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolAskUserQuestionDetails | false> {
    // We ALWAYS require "confirmation" because that's how we present the UI for this tool.
    // The "confirmation" here is actually the interaction itself.

    return {
      type: 'ask_user',
      title: 'Ask User Question',
      questions: this.params.questions,
      onConfirm: async (
        outcome: ToolConfirmationOutcome,
        payload?: ToolAskUserQuestionPayload,
      ) => {
        if (outcome === ToolConfirmationOutcome.ProceedOnce && payload) {
          this.answers = payload.answers;
        } else if (outcome === ToolConfirmationOutcome.Cancel) {
          // If cancelled, we don't set answers. execute() will handle the cancellation (error or empty).
        }
      },
    };
  }

  async execute(
    _signal: AbortSignal,
    _updateOutput?: (output: string) => void,
  ): Promise<ToolResult> {
    // If we have answers (populated via onConfirm), return them.
    // If not, it means the interaction was cancelled or failed.

    // Note: If the user cancels in the UI, the `onConfirm` with `Cancel` is called.
    // The framework might throw an error or handle cancellation before calling execute.
    // If execute IS called but we have no answers, we should return an empty or error result.
    // However, usually if shouldConfirmExecute returns details, and the user cancels,
    // the framework (ToolBuilder/Executor) throws a cancellation error and execute is NOT called.
    // So we can assume if we are here, we might have answers or it's an auto-allow case (which shouldn't happen for this tool).

    return {
      llmContent: safeJsonStringify({ answers: this.answers }),
      returnDisplay: safeJsonStringify({ answers: this.answers }),
    };
  }
}

export class AskUserQuestionTool extends BaseDeclarativeTool<
  AskUserQuestionParams,
  ToolResult
> {
  constructor(messageBus?: MessageBus) {
    super(
      ASK_USER_QUESTION_TOOL_NAME,
      'Ask User Question',
      'Use this tool when you need to ask the user questions during execution. This allows you to: 1. Gather user preferences or requirements, 2. Clarify ambiguous instructions, 3. Get decisions on implementation choices as you work, 4. Offer choices to the user about what direction to take. Users will always be able to select "Other" to provide custom text input. Use multiSelect: true to allow multiple answers to be selected for a question.',
      Kind.Other,
      {
        type: 'object',
        required: ['questions'],
        additionalProperties: false,
        properties: {
          questions: {
            type: 'array',
            description: 'Questions to ask the user (1-4 questions)',
            minItems: 1,
            maxItems: 4,
            items: {
              type: 'object',
              required: ['question', 'header', 'options', 'multiSelect'],
              additionalProperties: false,
              properties: {
                question: {
                  type: 'string',
                  description:
                    'The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?" If multiSelect is true, phrase it accordingly, e.g. "Which features do you want to enable?"',
                },
                header: {
                  type: 'string',
                  description:
                    'Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".',
                },
                multiSelect: {
                  type: 'boolean',
                  description:
                    'Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.',
                },
                options: {
                  type: 'array',
                  description:
                    "The available choices for this question. Must have 2-4 options. Each option should be a distinct, mutually exclusive choice (unless multiSelect is enabled). There should be no 'Other' option, that will be provided automatically.",
                  minItems: 2,
                  maxItems: 4,
                  items: {
                    type: 'object',
                    required: ['label', 'description'],
                    additionalProperties: false,
                    properties: {
                      label: {
                        type: 'string',
                        description:
                          'The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.',
                      },
                      description: {
                        type: 'string',
                        description:
                          'Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.',
                      },
                    },
                  },
                },
              },
            },
          },
          answers: {
            type: 'object',
            description: 'User answers collected',
            additionalProperties: { type: 'string' },
          },
        },
      },
      // isOutputMarkdown
      false,
      // canUpdateOutput
      false,
      messageBus,
    );
  }

  protected createInvocation(
    params: AskUserQuestionParams,
    messageBus?: MessageBus,
    toolName?: string,
    displayName?: string,
  ): ToolInvocation<AskUserQuestionParams, ToolResult> {
    return new AskUserQuestionInvocation(
      params,
      messageBus,
      toolName,
      displayName,
    );
  }
}
