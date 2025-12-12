/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderWithProviders } from '../../../test-utils/render.js';
import { describe, it, expect, vi } from 'vitest';
import { AskUserForm } from './AskUserForm.js';
import { act } from 'react';

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

  it('activates input when navigating to Other', async () => {
    const { lastFrame, stdin } = renderWithProviders(
      <AskUserForm
        questions={mockQuestions}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const write = async (input: string) => {
      await act(async () => {
        stdin.write(input);
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    // Initial state: Option A selected
    expect(lastFrame()).toContain('● Option A');

    // Move down to Option B
    await write('\x1B[B');
    expect(lastFrame()).toContain('● Option B');

    // Move down to Other
    await write('\x1B[B');

    // Should show active input indicator/placeholder
    expect(lastFrame()).toContain('(+)');
    expect(lastFrame()).toContain('Type something...');
  });

  it('adds custom options in multi-select mode', async () => {
    const multiSelectQuestions = [
      {
        question: 'Select multiple',
        header: 'Test Multi',
        multiSelect: true,
        options: [
          { label: 'Opt 1', description: 'Description for Opt 1' },
          { label: 'Opt 2', description: 'Description for Opt 2' },
        ],
      },
    ];

    const onComplete = vi.fn();
    const { lastFrame, stdin } = renderWithProviders(
      <AskUserForm
        questions={multiSelectQuestions}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />,
    );

    const write = async (input: string) => {
      await act(async () => {
        stdin.write(input);
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    // Move to Other (Opt 1 -> Opt 2 -> Other)
    await write('\x1B[B'); // To Opt 2
    await write('\x1B[B'); // To Other

    // Verify input is active
    expect(lastFrame()).toContain('Type something...');

    // Type "Custom1"
    await write('Custom1');
    await write('\r'); // Enter

    // Verify Custom1 is added and selected
    const frameAfterFirst = lastFrame();
    expect(frameAfterFirst).toContain('[x] Custom1');
    // Verify focus is still on Other (showing input)
    expect(frameAfterFirst).toContain('Type something...');

    // Type "Custom2"
    await write('Custom2');
    await write('\r');

    // Verify Custom2 is added
    expect(lastFrame()).toContain('[x] Custom2');

    // Navigate down to "Done" (Input -> Done)
    await write('\x1B[B');

    // Verify Done is highlighted (green text usually, or just check we are past Other)
    // In multi-select, Done is rendered.
    // We can just press Enter on Done.
    await write('\r');

    // Check completion
    expect(onComplete).toHaveBeenCalled();
    const result = onComplete.mock.calls[0][0];
    // Expected: comma separated values.
    expect(result['Select multiple']).toContain('Custom1');
    expect(result['Select multiple']).toContain('Custom2');
  });
});
