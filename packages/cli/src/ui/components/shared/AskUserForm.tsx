/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
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

const TabBar: React.FC<{
  questions: Question[];
  activeIndex: number;
  isReviewing: boolean;
}> = ({ questions, activeIndex, isReviewing }) => (
  <Box
    flexDirection="row"
    marginBottom={1}
    borderStyle="single"
    borderColor={theme.border.default}
  >
    {questions.map((q, i) => {
      const isActive = !isReviewing && i === activeIndex;
      return (
        <Box key={i} marginRight={2}>
          <Text
            color={isActive ? theme.status.success : theme.text.secondary}
            bold={isActive}
            underline={isActive}
          >
            {q.header || `Q${i + 1}`}
          </Text>
        </Box>
      );
    })}
    <Box>
      <Text
        color={isReviewing ? theme.status.success : theme.text.secondary}
        bold={isReviewing}
        underline={isReviewing}
      >
        Review
      </Text>
    </Box>
  </Box>
);

export const AskUserForm: React.FC<AskUserFormProps> = ({
  questions,
  onComplete,
  onCancel,
}) => {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // State for the current active question interaction
  const [multiSelection, setMultiSelection] = useState<Set<string>>(new Set());
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [isOtherActive, setIsOtherActive] = useState(false);

  const currentQuestion = questions[questionIndex];
  const { columns, rows } = useTerminalSize();

  const buffer = useTextBuffer({
    initialText: '',
    viewport: { width: columns, height: Math.min(10, Math.max(5, rows - 10)) },
    isValidPath: () => true,
    singleLine: false,
  });
  const { setText: bufferSetText } = buffer;

  // Initialize state when switching questions
  useMemo(() => {
    // Determine initial values based on saved answers if revisiting
    const savedAnswer = answers[currentQuestion?.question];

    if (currentQuestion?.multiSelect) {
      const initialSet = new Set<string>();
      const initialCustom: string[] = [];

      if (savedAnswer) {
        savedAnswer.split(', ').forEach((val) => {
          const isPredefined = currentQuestion.options?.some(
            (opt) => opt.label === val,
          );
          if (!isPredefined) {
            initialCustom.push(val);
          }
          initialSet.add(val);
        });
      }
      setMultiSelection(initialSet);
      setCustomOptions(initialCustom);
    } else {
      // For single select, we don't need complex state initialization here
      // as it's handled by finding the option or using custom input
      setMultiSelection(new Set());
      setCustomOptions([]);
    }

    bufferSetText('');
    setIsOtherActive(false);
  }, [currentQuestion, answers, bufferSetText]);

  // Global navigation handler
  useInput((input, key) => {
    if (isReviewing) {
      if (key.return) {
        onComplete(answers);
      } else if (key.escape) {
        setIsReviewing(false);
        setQuestionIndex(questions.length - 1);
      }
      // TODO: Add support for navigating back to specific questions from review
      return;
    }

    // Allow Tab to cycle through questions?
    // Maybe Ctrl+Left/Right?
    if (key.pageDown) {
      // Next question
      handleNext();
    }
    if (key.pageUp) {
      // Prev question
      handlePrev();
    }
    if (key.escape) {
      onCancel();
    }
  });

  const handleNext = () => {
    // Validation?
    if (questionIndex < questions.length - 1) {
      setQuestionIndex((i) => i + 1);
    } else {
      setIsReviewing(true);
    }
  };

  const handlePrev = () => {
    if (questionIndex > 0) {
      setQuestionIndex((i) => i - 1);
    }
  };

  const saveCurrentAnswer = (ans: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.question]: ans }));
    handleNext();
  };

  const items: FormItem[] = useMemo(() => {
    if (!currentQuestion?.options) return [];
    if (currentQuestion.options.length === 0) return [];

    const opts: FormItem[] = currentQuestion.options.map((opt) => ({
      key: opt.label,
      value: opt.label,
      label: opt.label,
      description: opt.description,
    }));

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

  // Hook for the list logic
  const { activeIndex, setActiveIndex } = useSelectionList({
    items,
    isFocused:
      !isOtherActive &&
      !isReviewing &&
      (currentQuestion?.options?.length ?? 0) > 0,
    showNumbers: true,
    onSelect: (value) => {
      if (value === DONE_VALUE) {
        const ans = Array.from(multiSelection).join(', ');
        saveCurrentAnswer(ans);
      } else if (value === OTHER_VALUE) {
        // Handled by effect
      } else if (currentQuestion.multiSelect) {
        const newSet = new Set(multiSelection);
        if (newSet.has(value)) newSet.delete(value);
        else newSet.add(value);
        setMultiSelection(newSet);
      } else {
        saveCurrentAnswer(value);
      }
    },
  });

  // Effect to toggle input mode for "Other"
  useMemo(() => {
    const isOther = items[activeIndex]?.isOther ?? false;
    if (isOther !== isOtherActive) {
      setIsOtherActive(isOther);
    }
  }, [activeIndex, items, isOtherActive]);

  const handleInputSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (currentQuestion.multiSelect) {
      setCustomOptions((prev) => [...prev, trimmed]);
      setMultiSelection((prev) => new Set(prev).add(trimmed));
      bufferSetText('');
      // Focus remains on "Other" (which shifts index due to new item insertion, handled by hook usually?)
      // Actually, since we modify items array, hook might reset or shift.
      // Ideally we want to stay on "Other".
    } else {
      saveCurrentAnswer(trimmed);
    }
  };

  const handleInputCancel = () => {
    bufferSetText('');
    if (activeIndex > 0) setActiveIndex(activeIndex - 1);
  };

  if (isReviewing) {
    return (
      <Box flexDirection="column">
        <TabBar questions={questions} activeIndex={-1} isReviewing={true} />
        <Box flexDirection="column" marginBottom={1}>
          <Text bold underline>
            Summary
          </Text>
          {questions.map((q, i) => (
            <Box key={i} flexDirection="column" marginTop={1}>
              <Text bold color={theme.text.secondary}>
                {q.question}
              </Text>
              <Text color={theme.text.primary}>
                {' '}
                {answers[q.question] || '(No answer)'}
              </Text>
            </Box>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text>
            Press{' '}
            <Text bold color={theme.status.success}>
              Enter
            </Text>{' '}
            to submit,{' '}
            <Text bold color={theme.status.warning}>
              Esc
            </Text>{' '}
            to edit.
          </Text>
        </Box>
      </Box>
    );
  }

  if (!currentQuestion) return null;

  const isTextOnly = (currentQuestion.options?.length ?? 0) === 0;

  return (
    <Box flexDirection="column">
      <TabBar
        questions={questions}
        activeIndex={questionIndex}
        isReviewing={false}
      />

      <Box marginBottom={1}>
        <Text bold>{currentQuestion.question}</Text>
        {currentQuestion.multiSelect && (
          <Text color={theme.text.secondary}>
            {' '}
            (Select multiple, choose Done when finished)
          </Text>
        )}
      </Box>

      {isTextOnly ? (
        <Box flexDirection="column">
          <Text>Enter value:</Text>
          <TextInput
            buffer={buffer}
            onSubmit={handleInputSubmit}
            onCancel={() => {}}
            focus={true}
          />
        </Box>
      ) : (
        <Box flexDirection="column">
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const isSelected = currentQuestion.multiSelect
              ? multiSelection.has(item.value)
              : false;

            if (item.isOther && isActive) {
              return (
                <Box key={item.key} flexDirection="row">
                  <Text color={theme.status.success}>
                    {currentQuestion.multiSelect ? '(+)' : '●'}{' '}
                  </Text>
                  <TextInput
                    buffer={buffer}
                    placeholder="Type something..."
                    onSubmit={handleInputSubmit}
                    onCancel={handleInputCancel}
                    onArrowUp={() => index > 0 && setActiveIndex(index - 1)}
                    onArrowDown={() =>
                      index < items.length - 1 && setActiveIndex(index + 1)
                    }
                    focus={true}
                  />
                </Box>
              );
            }

            let symbol = isActive ? '●' : '○';
            if (currentQuestion.multiSelect) {
              symbol = isSelected ? '[x]' : '[ ]';
              if (item.isDone) symbol = '   ';
              if (item.isOther) symbol = '( )';
            } else if (item.isOther) {
              symbol = '○';
            }

            return (
              <Box key={item.key} flexDirection="row">
                <Text
                  color={isActive ? theme.status.success : theme.text.secondary}
                >
                  {symbol}{' '}
                </Text>
                <Box flexDirection="column">
                  <Text
                    color={
                      isActive || (item.isDone && isActive)
                        ? theme.status.success
                        : theme.text.primary
                    }
                  >
                    {item.label}
                  </Text>
                  {item.description && (
                    <Text color={theme.text.secondary} dimColor>
                      {' '}
                      {item.description}
                    </Text>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Box
        marginTop={1}
        borderStyle="single"
        borderColor={theme.border.default}
      >
        <Text dimColor>
          PageUp/Down to navigate questions | Enter to select/next | Esc to
          cancel
        </Text>
      </Box>
    </Box>
  );
};
