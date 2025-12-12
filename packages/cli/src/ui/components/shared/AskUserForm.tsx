/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import { TextInput } from './TextInput.js';
import { useTextBuffer } from './text-buffer.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import {
  useSelectionList,
  type SelectionListItem,
} from '../../hooks/useSelectionList.js';
import type { Question } from '@google/gemini-cli-core';

interface AskUserFormProps {
  questions: Question[];
  onComplete: (answers: Record<string, string>) => void;
  onCancel: () => void;
}

const OTHER_VALUE = '__OTHER__';
const DONE_VALUE = '__DONE__';

interface FormItem extends SelectionListItem<string> {
  label: string;
  description?: string;
  isOther?: boolean;
  isDone?: boolean;
}

export const AskUserForm: React.FC<AskUserFormProps> = ({
  questions,
  onComplete,
  onCancel: _onCancel,
}) => {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multiSelection, setMultiSelection] = useState<Set<string>>(new Set());
  const [customOptions, setCustomOptions] = useState<string[]>([]);

  const currentQuestion = questions[questionIndex];
  const { columns, rows } = useTerminalSize();
  const buffer = useTextBuffer({
    initialText: '',
    viewport: { width: columns, height: Math.min(10, Math.max(5, rows - 10)) },
    isValidPath: () => true, // Not relevant here
    singleLine: false,
  });
  const { setText: bufferSetText } = buffer;

  // Reset state when advancing to next question
  useEffect(() => {
    setMultiSelection(new Set());
    setCustomOptions([]);
    bufferSetText('');
  }, [questionIndex, bufferSetText]);

  const items: FormItem[] = useMemo(() => {
    if (!currentQuestion?.options) return [];

    // If we have no options, we don't render items, we just use the input
    if (currentQuestion.options.length === 0) {
      return [];
    }

    const opts: FormItem[] = currentQuestion.options.map((opt) => ({
      key: opt.label,
      value: opt.label,
      label: opt.label,
      description: opt.description,
    }));

    // Add user-created custom options
    customOptions.forEach((opt) => {
      opts.push({
        key: opt,
        value: opt,
        label: opt,
        description: 'Custom value',
      });
    });

    opts.push({
      key: OTHER_VALUE,
      value: OTHER_VALUE,
      label: 'Other...',
      description: 'Enter a custom value',
      isOther: true,
    });

    if (currentQuestion.multiSelect) {
      opts.push({
        key: DONE_VALUE,
        value: DONE_VALUE,
        label: 'Done',
        description: 'Finish selection',
        isDone: true,
      });
    }

    return opts;
  }, [currentQuestion, customOptions]);

  const isTextOnlyQuestion = currentQuestion?.options.length === 0;

  // We determine if we are "typing in Other" based on whether the active item is the Other item.
  // We need the `activeIndex` first.
  // However, `useSelectionList` needs to know if it should be focused.
  // We can't use `activeIndex` from `useSelectionList` result before calling it.
  // BUT: `useSelectionList` state is consistent.
  // We can assume if we are rendering, we can use the state from the hook.
  // Wait, we need the `activeIndex` from the hook return to know if we should disable the hook's focus.
  // This is a cycle if we pass `isFocused` based on `activeIndex`.
  // Solution: `useSelectionList` will always be mounted. We can just use a ref or effect to toggle?
  // No, React handles this. The `activeIndex` from the *previous* render determines the props for the *current* render call of the hook.
  // This works fine for state transitions.

  // We need a way to access the current activeIndex before knowing if we are typing.
  // Let's use a two-pass approach or just accept that `activeIndex` comes from the hook.
  // Actually, we can just use the hook with `isFocused={true}` initially.
  // But wait, if we pass `isFocused={true}` to the hook, it will trap arrow keys.
  // We want `TextInput` to trap arrow keys when "Other" is active.
  // So we need `isFocused` to be false when "Other" is active.

  // Let's define a wrapper component? No, keep it simple.
  // We can use a ref to track "local input focus" but that desyncs.
  // Better: We let `useSelectionList` run always, BUT we use the `onSelect` or similar to detect entry?
  // No.
  // Let's look at `useSelectionList`. It exposes `activeIndex`.
  // If `items[activeIndex]?.isOther` is true, we simply pass `isFocused: false` to the hook on the *next* render?
  // No, inside the SAME render function:
  // `const { activeIndex } = useSelectionList(...)`
  // `const isTypingInOther = items[activeIndex]?.isOther`
  // `useSelectionList` uses the `isFocused` prop we passed *in*.
  // So:
  // Render 1: `isTyping` (derived from state `activeIndex` 0) = false. Pass `isFocused=true`.
  // User presses Down... `activeIndex` becomes `OtherIndex`.
  // Render N: `activeIndex` is `OtherIndex`. `isTyping` becomes true.
  // BUT `useSelectionList` was called with `isFocused=true` (from previous logic? No, derived from current vars).
  // Wait, `isTyping` is derived from `activeIndex`. `activeIndex` comes from `useSelectionList`.
  // `useSelectionList` is called *before* we know `activeIndex`.
  // So we can't pass `isFocused` based on the result of the hook call in the same render pass easily without a second render.
  // Actually, `useSelectionList` hook internals use `useKeypress` which attaches listeners.
  // If we change `isFocused` prop, it updates the listener attachment in `useEffect`.
  // So:
  // 1. `useSelectionList` returns `activeIndex`.
  // 2. We calculate `isTypingInOther`.
  // 3. IF `isTypingInOther` is different from what we expected, we force a re-render?
  // No, we can't easily force re-render inside render.
  //
  // Alternative: Lift the `activeIndex` state OUT of `useSelectionList`.
  // `useSelectionList` supports `initialIndex`, but it manages its own state.
  // We can't control it fully unless we modify the hook or use a different pattern.
  //
  // However, `useSelectionList` DOES return `setActiveIndex`.
  // And `TextInput` needs to control it.
  //
  // Let's use a trick: `useSelectionList` is always focused for *navigation commands* that don't conflict?
  // No, Up/Down conflict.
  //
  // Let's introduce a state `isOtherActive` in the component.
  // Synced with `activeIndex`.
  // Effect: `useEffect(() => { setIsOtherActive(items[activeIndex]?.isOther); }, [activeIndex, items])`.
  // This causes a double render when landing on Other, which is fine.
  // Render 1 (land on Other): `isOtherActive` is false. `useSelectionList` focused. `TextInput` not focused (or just text).
  // Effect runs -> `setIsOtherActive(true)`.
  // Render 2: `isOtherActive` is true. `useSelectionList` NOT focused. `TextInput` focused.
  // User types.
  // User presses Up. `TextInput` calls `onArrowUp`.
  // We call `setActiveIndex(prev)`.
  // `activeIndex` changes.
  // Effect runs -> `setIsOtherActive(false)`.
  // Render 3: `isOtherActive` false. `useSelectionList` focused.

  const [isOtherActive, setIsOtherActive] = useState(false);

  // We need to declare the hook.
  const { activeIndex, setActiveIndex } = useSelectionList({
    items,
    onSelect: (val) => handleSelect(val), // Wrapper to avoid circular dependency if needed
    isFocused: !isOtherActive && !isTextOnlyQuestion,
    showNumbers: true,
  });

  // Sync isOtherActive
  useEffect(() => {
    const isOther = items[activeIndex]?.isOther ?? false;
    if (isOther !== isOtherActive) {
      setIsOtherActive(isOther);
    }
    // Automatically focus input when entering "Other" is handled by this state flip.
  }, [activeIndex, items, isOtherActive]);

  const handleSelect = (value: string) => {
    if (!currentQuestion) return;

    if (value === DONE_VALUE) {
      if (
        multiSelection.size === 0 &&
        questions[questionIndex].options.length > 0
      ) {
        // Validation: must select something?
        // Let's assume yes for now if required.
      }
      const combinedAnswer = Array.from(multiSelection).join(', ');
      saveAnswer(combinedAnswer);
      return;
    }

    if (value === OTHER_VALUE) {
      // Logic handled by side-effect of activeIndex change
      return;
    }

    if (currentQuestion.multiSelect) {
      const newSet = new Set(multiSelection);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      setMultiSelection(newSet);
    } else {
      saveAnswer(value);
    }
  };

  const saveAnswer = (answer: string) => {
    const newAnswers = { ...answers, [currentQuestion!.question]: answer };
    setAnswers(newAnswers);

    if (questionIndex < questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else {
      onComplete(newAnswers);
    }
  };

  const handleInputSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      // If empty, maybe just nothing? or move focus?
      // If on "Other" and empty enter -> do nothing or treat as empty?
      // Let's do nothing if empty.
      return;
    }

    if (currentQuestion?.multiSelect) {
      // Add custom option
      setCustomOptions((prev) => [...prev, trimmed]);
      setMultiSelection((prev) => {
        const next = new Set(prev);
        next.add(trimmed);
        return next;
      });
      bufferSetText('');
      // Focus stays on "Other" naturally because activeIndex tracks keys,
      // and "Other" key is constant.
      // But we inserted an item BEFORE "Other".
      // So "Other" index increments.
      // `useSelectionList` should handle this re-calculation of index based on key.
    } else {
      saveAnswer(trimmed);
    }
  };

  const handleInputCancel = () => {
    // If user cancels input in "Other", maybe just clear text?
    bufferSetText('');
    // And move focus up?
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleArrowUp = () => {
    // Move to previous item
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleArrowDown = () => {
    // Move to next item (Done)
    if (activeIndex < items.length - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  if (!currentQuestion) return null;

  // Render for text-only question (no options)
  if (isTextOnlyQuestion) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>{currentQuestion.question}</Text>
        </Box>
        <Box flexDirection="column">
          <Text>Enter value:</Text>
          <TextInput
            buffer={buffer}
            onSubmit={handleInputSubmit}
            onCancel={() => {}} // No cancel for main question?
            focus={true}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>{currentQuestion.question}</Text>
        {currentQuestion.multiSelect && (
          <Text color={theme.text.secondary}>
            {' '}
            (Select multiple, choose Done when finished)
          </Text>
        )}
      </Box>

      <Box flexDirection="column">
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const isSelected = currentQuestion.multiSelect
            ? multiSelection.has(item.value)
            : false;

          // Special rendering for "Other" when active
          if (item.isOther && isActive) {
            return (
              <Box key={item.key} flexDirection="column" marginBottom={0}>
                <Box flexDirection="row">
                  <Box marginRight={1}>
                    <Text color={theme.status.success}>{'(+)'}</Text>
                  </Box>
                  <Box flexDirection="column">
                    <TextInput
                      buffer={buffer}
                      placeholder="Type something..."
                      onSubmit={handleInputSubmit}
                      onCancel={handleInputCancel}
                      onArrowUp={handleArrowUp}
                      onArrowDown={handleArrowDown}
                      focus={true}
                    />
                  </Box>
                </Box>
              </Box>
            );
          }

          // Standard Item Rendering
          let symbol = ' ';
          if (currentQuestion.multiSelect) {
            symbol = isSelected ? '[x]' : '[ ]';
            if (item.isDone) symbol = '   ';
            if (item.isOther) symbol = '( )'; // Inactive "Other"
          } else {
            symbol = isActive ? '●' : '○';
            if (item.isOther) symbol = '○';
          }

          let color = theme.text.primary;
          if (isActive) color = theme.status.success;
          if (item.isDone && isActive) color = theme.status.success;

          return (
            <Box key={item.key} flexDirection="column" marginBottom={0}>
              <Box flexDirection="row">
                <Box marginRight={1}>
                  <Text
                    color={
                      isActive ? theme.status.success : theme.text.secondary
                    }
                  >
                    {symbol}
                  </Text>
                </Box>
                <Box flexDirection="column">
                  <Text color={color}>{item.label}</Text>
                  {item.description && (
                    <Text color={theme.text.secondary} dimColor>
                      {' '}
                      {item.description}
                    </Text>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
