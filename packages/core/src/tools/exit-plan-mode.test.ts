/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExitPlanModeTool } from './exit-plan-mode.js';
import type { Config } from '../config/config.js';
import { ApprovalMode } from '../policy/types.js';

describe('ExitPlanModeTool', () => {
  let tool: ExitPlanModeTool;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      getApprovalMode: vi.fn(() => ApprovalMode.PLAN_MODE),
      setApprovalMode: vi.fn(),
      getTargetDir: vi.fn(() => '/tmp'),
    } as unknown as Config;

    tool = new ExitPlanModeTool(mockConfig);
  });

  it('should have correct name and description', () => {
    expect(tool.name).toBe('exit_plan_mode');
    expect(tool.description).toContain('Exit planning mode');
  });

  it('should execute and set approval mode to DEFAULT', async () => {
    const params = {
      plan: 'My plan',
    };

    const result = await tool.buildAndExecute(params, new AbortController().signal);

    expect(mockConfig.setApprovalMode).toHaveBeenCalledWith(ApprovalMode.DEFAULT);
    expect(result.llmContent).toContain('Exited plan mode');
  });

  it('should accept valid parameters', () => {
    const params = {
      plan: 'My valid plan',
    };
    expect(tool.validateToolParams(params)).toBeNull();
  });

  it('should validate missing plan', () => {
    // @ts-expect-error testing invalid params
    const params = {};
    const validationError = tool.validateToolParams(params);
    expect(validationError).toBeTruthy();
  });
});
