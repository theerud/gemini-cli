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
    expect(frame).toContain('☐ Test');
    expect(frame).toContain('✔ Submit');
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
      await new Promise((resolve) => setTimeout(resolve, 50));
    };

    // Initial state: Option A selected
    expect(lastFrame()).toContain('1. Option A');

    // Move down to Option B
    await write('\x1B[B');
    expect(lastFrame()).toContain('2. Option B');

    // Move down to Other
    await write('\x1B[B');

    // Should show active input indicator/placeholder
    expect(lastFrame()).toContain('3.');
    expect(lastFrame()).toContain('Type something...');
  });

  it('navigates to review screen and submits', async () => {
    const onComplete = vi.fn();
    const { lastFrame, stdin } = renderWithProviders(
      <AskUserForm
        questions={mockQuestions}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />,
    );

    const write = async (input: string) => {
      await act(async () => {
        stdin.write(input);
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
    };

    // Select Option A (default) by pressing Enter
    await write('\r');

    // Now should be on Review screen
    const frame = lastFrame();
    expect(frame).toContain('Review your answers');
    expect(frame).toContain('Select an option');
    expect(frame).toContain('→ Option A');
    expect(frame).toContain('Submit answers');

    // Submit
    await write('\r');

    expect(onComplete).toHaveBeenCalledWith({ 'Select an option': 'Option A' });
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
      await new Promise((resolve) => setTimeout(resolve, 50));
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

    // Navigate down to "Done" (Input -> Done)
    await write('\x1B[B');

    // Select Done
    await write('\r');

    // Now on Review Screen
    expect(lastFrame()).toContain('Review your answers');
    expect(lastFrame()).toContain('Custom1');

    // Submit
    await write('\r');

    // Check completion
    expect(onComplete).toHaveBeenCalled();
    const result = onComplete.mock.calls[0][0];
    expect(result['Select multiple']).toContain('Custom1');
  });

  it('allows navigating back to previous questions', async () => {
    const twoQuestions = [
      {
        question: 'Q1',
        header: 'H1',
        multiSelect: false,
        options: [
          { label: 'A', description: '' },
          { label: 'B', description: '' },
        ],
      },
      {
        question: 'Q2',
        header: 'H2',
        multiSelect: false,
        options: [
          { label: 'C', description: '' },
          { label: 'D', description: '' },
        ],
      },
    ];

    const { lastFrame, stdin } = renderWithProviders(
      <AskUserForm
        questions={twoQuestions}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const write = async (input: string) => {
      await act(async () => {
        stdin.write(input);
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
    };

    // Answer Q1
    await write('\r');
    expect(lastFrame()).toContain('Q2');

    // Go back to Q1 using Left Arrow
    await write('\x1B[D');
    expect(lastFrame()).toContain('Q1');
    expect(lastFrame()).toContain('☒ H1');

    // Go to Q2 using Right Arrow
    await write('\x1B[C');
    expect(lastFrame()).toContain('Q2');

    // Go to Review using Right Arrow
    await write('\x1B[C');
    expect(lastFrame()).toContain('Review your answers');
  });
});
