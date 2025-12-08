/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { renderHook } from '../../test-utils/render.js';
import { useAutoAcceptIndicator } from './useAutoAcceptIndicator.js';
import type { Config } from '@google/gemini-cli-core';

// Mock useKeypress
vi.mock('./useKeypress.js', () => ({
  useKeypress: vi.fn((handler) => {
    // Expose the handler so tests can trigger it
    (
      global as unknown as { triggerKeypress: (key: unknown) => void }
    ).triggerKeypress = handler;
  }),
}));

describe('useAutoAcceptIndicator with Plan Mode', () => {
  let mockConfigInstance: Config;
  let getApprovalModeMock: Mock;
  let setApprovalModeMock: Mock;

  beforeEach(() => {
    getApprovalModeMock = vi.fn();
    setApprovalModeMock = vi.fn();

    mockConfigInstance = {
      getApprovalMode: getApprovalModeMock,
      setApprovalMode: setApprovalModeMock,
      isYoloModeDisabled: vi.fn().mockReturnValue(false),
    } as unknown as Config;
  });

  const triggerTogglePlanMode = () => {
    // Simulate Shift+Tab
    act(() => {
      (
        global as unknown as { triggerKeypress: (key: unknown) => void }
      ).triggerKeypress({ name: 'tab', shift: true });
    });
  };

  it('should cycle from DEFAULT to AUTO_EDIT to PLAN_MODE and back to DEFAULT', () => {
    // 1. Start at DEFAULT
    getApprovalModeMock.mockReturnValue('default');
    const mockOnApprovalModeChange = vi.fn();

    renderHook(() =>
      useAutoAcceptIndicator({
        config: mockConfigInstance,
        onApprovalModeChange: mockOnApprovalModeChange,
      }),
    );

    // 2. Trigger Shift+Tab (Default -> AutoEdit)
    triggerTogglePlanMode();
    expect(setApprovalModeMock).toHaveBeenCalledWith('autoEdit');
    expect(mockOnApprovalModeChange).toHaveBeenCalledWith('autoEdit');

    // 3. Simulate state change to AUTO_EDIT
    getApprovalModeMock.mockReturnValue('autoEdit');
    triggerTogglePlanMode();
    expect(setApprovalModeMock).toHaveBeenCalledWith('planMode');
    expect(mockOnApprovalModeChange).toHaveBeenCalledWith('planMode');

    // 4. Simulate state change to PLAN_MODE
    getApprovalModeMock.mockReturnValue('planMode');
    triggerTogglePlanMode();
    expect(setApprovalModeMock).toHaveBeenCalledWith('default');
    expect(mockOnApprovalModeChange).toHaveBeenCalledWith('default');
  });
});
