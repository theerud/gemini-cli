/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderWithProviders } from '../../../test-utils/render.js';
import { describe, it, expect, vi } from 'vitest';
import { AskUserForm } from './AskUserForm.js';

// Mock imports that might cause issues in test environment
vi.mock('../../hooks/useTerminalSize.js', () => ({
  useTerminalSize: () => ({ columns: 80, rows: 24 }),
}));

describe('AskUserForm', () => {
  const mockQuestions = [
    {
      question: 'Select an option',
      header: 'Test',
      multiSelect: false,
      options: [
        { label: 'Option A', description: 'Desc A' },
        { label: 'Option B', description: 'Desc B' },
      ],
    },
  ];

  it('renders correctly', () => {
    const { lastFrame } = renderWithProviders(
      <AskUserForm
        questions={mockQuestions}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('Select an option');
    expect(frame).toContain('Option A');
    expect(frame).toContain('Option B');
    expect(frame).toContain('Other...');
  });
});
