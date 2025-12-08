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
  const [isInputActive, setIsInputActive] = useState(false);
  const [otherText, setOtherText] = useState('');

  const currentQuestion = questions[questionIndex];
  const { columns } = useTerminalSize();
  const buffer = useTextBuffer({
    initialText: '',
    viewport: { width: columns, height: 1 }, // Single line input usually
    isValidPath: () => true, // Not relevant here
    singleLine: true,
  });
  const { setText: bufferSetText } = buffer;

  // Reset state when advancing to next question
  useEffect(() => {
    setMultiSelection(new Set());
    setIsInputActive(false);
    setOtherText('');
    bufferSetText('');
  }, [questionIndex, bufferSetText]);

  const items: FormItem[] = useMemo(() => {
    if (!currentQuestion) return [];

    const opts: FormItem[] = currentQuestion.options.map((opt) => ({
      key: opt.label,
      value: opt.label,
      label: opt.label,
      description: opt.description,
    }));

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
  }, [currentQuestion]);

  const handleSelect = (value: string) => {
    if (!currentQuestion) return;

    if (value === DONE_VALUE) {
      if (multiSelection.size === 0 && !otherText) {
        // If nothing selected, do nothing (or maybe allow empty if valid?)
        // For now, let's assume at least one selection is required.
        return;
      }

      const combinedAnswer = Array.from(multiSelection).join(', ');
      saveAnswer(combinedAnswer);
      return;
    }

    if (value === OTHER_VALUE) {
      setIsInputActive(true);
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
    if (!value.trim()) {
      setIsInputActive(false); // Cancel input if empty
      return;
    }

    if (currentQuestion?.multiSelect) {
      // In multi-select, "Other" adds to the selection set but usually "Other" is a distinct answer.
      // For simplicity, let's treat "Other" in multi-select as adding a custom value to the list of selected items.
      // However, since we don't dynamically add items to the list, we can just treat it as a direct selection of "Other: <value>"
      // A better UX for multi-select other is: Input value -> Add to selection set -> Return to list.
      const val = value.trim();
      const newSet = new Set(multiSelection);
      newSet.add(val); // Add the custom value
      setMultiSelection(newSet);
      setIsInputActive(false);
    } else {
      saveAnswer(value.trim());
    }
  };

  const handleInputCancel = () => {
    setIsInputActive(false);
  };

  // We use the useSelectionList hook manually to control rendering
  const { activeIndex } = useSelectionList({
    items,
    onSelect: handleSelect,
    isFocused: !isInputActive,
    showNumbers: true,
  });

  if (!currentQuestion) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border.default}
      padding={1}
    >
      <Box marginBottom={1}>
        {currentQuestion.header && (
          <Box marginRight={1}>
            <Text color={theme.text.secondary} bold>
              [{currentQuestion.header}]
            </Text>
          </Box>
        )}
        <Text bold>{currentQuestion.question}</Text>
        {currentQuestion.multiSelect && (
          <Text color={theme.text.secondary}>
            {' '}
            (Select multiple, choose Done when finished)
          </Text>
        )}
      </Box>

      {isInputActive ? (
        <Box flexDirection="column">
          <Text>Enter custom value:</Text>
          <Box borderStyle="single" borderColor={theme.border.active}>
            <TextInput
              buffer={buffer}
              onSubmit={handleInputSubmit}
              onCancel={handleInputCancel}
              focus={true}
            />
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const isSelected = currentQuestion.multiSelect
              ? multiSelection.has(item.value)
              : false;

            // Determine symbol
            let symbol = ' ';
            if (currentQuestion.multiSelect) {
              symbol = isSelected ? '[x]' : '[ ]';
              if (item.isDone) symbol = '   '; // No checkbox for Done
              if (item.isOther) symbol = isSelected ? '[x]' : '[ ]'; // Checkbox for Other?
              // Actually, for "Other...", we don't show [x] until they type something.
              // But here item.value is __OTHER__. If they typed something, it's in multiSelection as the raw string.
              // So multiSelection.has('__OTHER__') is false.
              // Complex logic for showing "Other" selection state in multi-select is tricky without adding dynamic items.
              // Let's simplify: "Other..." always opens input.
              if (item.isOther) symbol = '(+)';
            } else {
              symbol = isActive ? '●' : '○';
            }

            let color = theme.text.primary;
            if (isActive) color = theme.status.success;
            if (item.isDone && isActive) color = theme.status.info;

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
      )}

      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          Question {questionIndex + 1} of {questions.length}
        </Text>
      </Box>
    </Box>
  );
};
