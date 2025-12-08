/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApprovalMode } from '@google/gemini-cli-core';
import type { SlashCommand, SlashCommandActionReturn } from './types.js';
import { CommandKind } from './types.js';

export const planModeCommand: SlashCommand = {
  name: 'plan-mode',
  description: 'Enter plan mode (disables write tools). Usage: /plan-mode',
  kind: CommandKind.BUILT_IN,
  action: async (context, _args): Promise<SlashCommandActionReturn | void> => {
    await context.ui.setApprovalMode(ApprovalMode.PLAN_MODE);
  },
};
