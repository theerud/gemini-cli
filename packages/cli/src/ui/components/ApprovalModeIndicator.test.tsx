/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '../../test-utils/render.js';
import { ApprovalModeIndicator } from './ApprovalModeIndicator.js';
import { describe, it, expect, vi } from 'vitest';
import { ApprovalMode } from '@google/gemini-cli-core';
import * as useTerminalSize from '../hooks/useTerminalSize.js';

vi.mock('../hooks/useTerminalSize.js', () => ({
  useTerminalSize: vi.fn(),
}));

const useTerminalSizeMock = vi.mocked(useTerminalSize.useTerminalSize);

describe('ApprovalModeIndicator', () => {
  it('renders correctly for AUTO_EDIT mode (wide)', () => {
    useTerminalSizeMock.mockReturnValue({ columns: 120, rows: 24 });
    const { lastFrame } = render(
      <ApprovalModeIndicator approvalMode={ApprovalMode.AUTO_EDIT} />,
    );
    const output = lastFrame();
    expect(output).toContain('auto-edit');
    expect(output).toContain('shift + tab to enter default mode');
  });

  it('renders correctly for AUTO_EDIT mode (compact)', () => {
    useTerminalSizeMock.mockReturnValue({ columns: 80, rows: 24 });
    const { lastFrame } = render(
      <ApprovalModeIndicator approvalMode={ApprovalMode.AUTO_EDIT} />,
    );
    const output = lastFrame();
    expect(output).toContain('auto-edit');
    expect(output).toContain('[⇧]+[⇥] for default');
    expect(output).not.toContain('mode');
  });

  it('renders correctly for PLAN mode (wide)', () => {
    useTerminalSizeMock.mockReturnValue({ columns: 120, rows: 24 });
    const { lastFrame } = render(
      <ApprovalModeIndicator approvalMode={ApprovalMode.PLAN} />,
    );
    const output = lastFrame();
    expect(output).toContain('plan');
    expect(output).toContain('shift + tab to enter auto-edit mode');
  });

  it('renders correctly for PLAN mode (compact)', () => {
    useTerminalSizeMock.mockReturnValue({ columns: 80, rows: 24 });
    const { lastFrame } = render(
      <ApprovalModeIndicator approvalMode={ApprovalMode.PLAN} />,
    );
    const output = lastFrame();
    expect(output).toContain('plan');
    expect(output).toContain('[⇧]+[⇥] for auto-edit');
  });

  it('renders correctly for YOLO mode (wide)', () => {
    useTerminalSizeMock.mockReturnValue({ columns: 120, rows: 24 });
    const { lastFrame } = render(
      <ApprovalModeIndicator approvalMode={ApprovalMode.YOLO} />,
    );
    const output = lastFrame();
    expect(output).toContain('YOLO');
    expect(output).toContain('shift + tab to enter auto-edit mode');
  });

  it('renders correctly for DEFAULT mode (wide)', () => {
    useTerminalSizeMock.mockReturnValue({ columns: 120, rows: 24 });
    const { lastFrame } = render(
      <ApprovalModeIndicator approvalMode={ApprovalMode.DEFAULT} />,
    );
    const output = lastFrame();
    expect(output).toContain('shift + tab to enter auto-edit mode');
  });

  it('renders correctly for DEFAULT mode with plan enabled (wide)', () => {
    useTerminalSizeMock.mockReturnValue({ columns: 120, rows: 24 });
    const { lastFrame } = render(
      <ApprovalModeIndicator
        approvalMode={ApprovalMode.DEFAULT}
        isPlanEnabled={true}
      />,
    );
    const output = lastFrame();
    expect(output).toContain('shift + tab to enter plan mode');
  });

  it('renders correctly for DEFAULT mode with plan enabled (compact)', () => {
    useTerminalSizeMock.mockReturnValue({ columns: 80, rows: 24 });
    const { lastFrame } = render(
      <ApprovalModeIndicator
        approvalMode={ApprovalMode.DEFAULT}
        isPlanEnabled={true}
      />,
    );
    const output = lastFrame();
    expect(output).toContain('[⇧]+[⇥] for plan');
  });
});
