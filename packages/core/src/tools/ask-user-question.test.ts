/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  AskUserQuestionTool,
  AskUserQuestionInvocation,
} from './ask-user-question.js';
import { ToolConfirmationOutcome } from './tools.js';
import type { MessageBus } from '../confirmation-bus/message-bus.js';

const mockMessageBus = {} as MessageBus;

describe('AskUserQuestionTool', () => {
  it('should instantiate correctly', () => {
    const tool = new AskUserQuestionTool(mockMessageBus);
    expect(tool.name).toBe('ask_user_question');
  });

  it('should validate valid parameters', () => {
    const tool = new AskUserQuestionTool(mockMessageBus);
    const params = {
      questions: [
        {
          question: 'Test question?',
          header: 'Test',
          multiSelect: false,
          options: [
            { label: 'A', description: 'Option A' },
            { label: 'B', description: 'Option B' },
          ],
        },
      ],
    };
    const invocation = tool.build(params);
    expect(invocation).toBeInstanceOf(AskUserQuestionInvocation);
  });

  it('should throw on invalid parameters (missing options)', () => {
    const tool = new AskUserQuestionTool(mockMessageBus);
    const params = {
      questions: [
        {
          question: 'Test question?',
          header: 'Test',
          multiSelect: false,
          options: [], // Invalid: minItems 2
        },
      ],
    };
    expect(() => tool.build(params)).toThrow();
  });
});

describe('AskUserQuestionInvocation', () => {
  it('should require confirmation and provide details', async () => {
    const params = {
      questions: [
        {
          question: 'Q1?',
          header: 'H1',
          multiSelect: false,
          options: [
            { label: '1', description: 'd1' },
            { label: '2', description: 'd2' },
          ],
        },
      ],
    };
    const invocation = new AskUserQuestionInvocation(params, mockMessageBus);
    const details = await invocation.shouldConfirmExecute(
      new AbortController().signal,
    );

    expect(details).not.toBe(false);
    if (details === false) return; // TS guard
    if (details.type !== 'ask_user') throw new Error('Wrong confirmation type');

    expect(details.questions).toEqual(params.questions);
  });

  it('should store answers from confirmation payload and return them in execute', async () => {
    const params = {
      questions: [
        {
          question: 'Q1?',
          header: 'H1',
          multiSelect: false,
          options: [
            { label: '1', description: 'd1' },
            { label: '2', description: 'd2' },
          ],
        },
      ],
    };
    const invocation = new AskUserQuestionInvocation(params, mockMessageBus);
    const details = await invocation.shouldConfirmExecute(
      new AbortController().signal,
    );

    if (details === false) throw new Error('Should require confirmation');
    if (details.type !== 'ask_user') throw new Error('Wrong confirmation type');

    const answers = { 'Q1?': '1' };
    // Simulate UI calling onConfirm with payload
    await details.onConfirm(ToolConfirmationOutcome.ProceedOnce, { answers });

    const result = await invocation.execute(new AbortController().signal);
    const expectedJson = JSON.stringify({ answers });
    expect(result.llmContent).toBe(expectedJson);
  });
});
