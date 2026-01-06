/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import { TextInput } from './TextInput.js';
import { useTextBuffer } from './text-buffer.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import {
  useSelectionList,
  type SelectionListItem,
} from '../../hooks/useSelectionList.js';
import { useKeypress } from '../../hooks/useKeypress.js';
import type { Question } from '@google/gemini-cli-core';

interface AskUserFormProps {
  questions: Question[];
  onComplete: (answers: Record<string, string>) => void;
  onCancel: () => void;
}

const OTHER_VALUE = '__OTHER__';
const DONE_VALUE = '__DONE__';
const SUBMIT_ACTION = 'submit';
const CANCEL_ACTION = 'cancel';

interface FormItem extends SelectionListItem<string> {
  label: string;
  description?: string;
  isOther?: boolean;
  isDone?: boolean;
}

const TabBar: React.FC<{
  questions: Question[];
  answers: Record<string, string>;
  activeTabIndex: number;
}> = ({ questions, answers, activeTabIndex }) => (
  <Box flexDirection="row" marginBottom={1} alignItems="center">
    <Text>← </Text>
    {questions.map((q, i) => {
      const isAnswered = !!answers[q.question];
      const isActive = activeTabIndex === i;
      const icon = isAnswered ? '☒' : '☐';
      return (
        <Box key={i} marginRight={2}>
          <Text
            color={isActive ? theme.status.success : theme.text.secondary}
            bold={isActive}
          >
            {icon} {q.header || `Q${i + 1}`}
          </Text>
        </Box>
      );
    })}
    <Box>
      <Text
        color={
          activeTabIndex === questions.length
            ? theme.status.success
            : theme.text.secondary
        }
        bold={activeTabIndex === questions.length}
      >
        ✔ Submit
      </Text>
    </Box>
    <Text> →</Text>
  </Box>
);

export const AskUserForm: React.FC<AskUserFormProps> = ({
  questions,
  onComplete,
  onCancel,
}) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isFinished, setIsFinished] = useState(false);

  // State for the current active question interaction
  const [multiSelection, setMultiSelection] = useState<Set<string>>(new Set());
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [isOtherActive, setIsOtherActive] = useState(false);

  const isReviewing = tabIndex === questions.length;
  const currentQuestion = questions[tabIndex];
  const { columns, rows } = useTerminalSize();

  const buffer = useTextBuffer({
    initialText: '',
    viewport: { width: columns, height: Math.min(10, Math.max(5, rows - 10)) },
    isValidPath: () => true,
    singleLine: false,
  });
  const { setText: bufferSetText } = buffer;

  // Helper to determine if we are in a mode where text input captures keys
  const isTextEditing =
    !isFinished &&
    !isReviewing &&
    currentQuestion &&
    ((currentQuestion.options?.length ?? 0) === 0 || isOtherActive);

  // Initialize state when switching tabs
  useEffect(() => {
    if (isFinished || isReviewing || !currentQuestion) {
      setIsOtherActive(false);
      return;
    }

    const savedAnswer = answers[currentQuestion.question];

    if (currentQuestion.multiSelect) {
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
      setMultiSelection(new Set());
      setCustomOptions([]);
    }

    bufferSetText('');
    setIsOtherActive(false);
  }, [
    tabIndex,
    isFinished,
    answers,
    bufferSetText,
    currentQuestion,
    isReviewing,
  ]);

  const handleNext = useCallback(() => {
    if (isFinished) return;
    if (tabIndex < questions.length) {
      setTabIndex((i) => i + 1);
    }
  }, [isFinished, tabIndex, questions.length]);

  const handlePrev = useCallback(() => {
    if (isFinished) return;
    if (tabIndex > 0) {
      setTabIndex((i) => i - 1);
    }
  }, [isFinished, tabIndex]);

  const handleFinalComplete = useCallback(() => {
    if (isFinished) return;
    setIsFinished(true);
    onComplete(answers);
  }, [isFinished, onComplete, answers]);

  const handleFinalCancel = useCallback(() => {
    if (isFinished) return;
    setIsFinished(true);
    onCancel();
  }, [isFinished, onCancel]);

  // Global navigation handler
  useKeypress(
    (key) => {
      // Context-aware Navigation
      if (!isTextEditing) {
        if (key.name === 'right') {
          handleNext();
          return;
        }
        if (key.name === 'left') {
          handlePrev();
          return;
        }
      }

      if (key.name === 'pagedown' || (key.ctrl && key.name === 'right')) {
        handleNext();
        return;
      }
      if (key.name === 'pageup' || (key.ctrl && key.name === 'left')) {
        handlePrev();
        return;
      }
      if (key.name === 'tab') {
        if (key.shift) handlePrev();
        else handleNext();
        return;
      }

      if (key.name === 'escape') {
        if (isReviewing || tabIndex > 0) {
          handlePrev();
        } else {
          handleFinalCancel();
        }
      }
    },
    { isActive: !isFinished },
  );

  const saveCurrentAnswer = (ans: string) => {
    if (isFinished) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.question]: ans }));
    handleNext();
  };

  // --- Question List Items ---
  const questionItems: FormItem[] = useMemo(() => {
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
        isDone: true,
      });
    }

    return opts;
  }, [currentQuestion, customOptions]);

  // --- Submit List Items ---
  const submitItems: FormItem[] = useMemo(
    () => [
      {
        key: SUBMIT_ACTION,
        value: SUBMIT_ACTION,
        label: 'Submit answers',
      },
      {
        key: CANCEL_ACTION,
        value: CANCEL_ACTION,
        label: 'Cancel',
      },
    ],
    [],
  );

  const activeItems = isReviewing ? submitItems : questionItems;
  const isListFocused = !isFinished && !isTextEditing && activeItems.length > 0;

  const { activeIndex, setActiveIndex } = useSelectionList({
    items: activeItems,
    isFocused: isListFocused,
    showNumbers: true,
    onSelect: (value) => {
      if (isFinished) return;

      if (isReviewing) {
        if (value === SUBMIT_ACTION) {
          handleFinalComplete();
        } else if (value === CANCEL_ACTION) {
          handleFinalCancel();
        }
        return;
      }

      // Question Mode
      if (value === DONE_VALUE) {
        const ans = Array.from(multiSelection).sort().join(', ');
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

  // Effect to toggle input mode for "Other" (Question Mode only)
  useEffect(() => {
    if (isFinished || isReviewing) return;
    const isOther = activeItems[activeIndex]?.isOther ?? false;
    if (isOther !== isOtherActive) {
      setIsOtherActive(isOther);
    }
  }, [activeIndex, activeItems, isOtherActive, isReviewing, isFinished]);

  const handleInputSubmit = (value: string) => {
    if (isFinished) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    if (currentQuestion.multiSelect) {
      setCustomOptions((prev) => [...prev, trimmed]);
      setMultiSelection((prev) => {
        const next = new Set(prev);
        next.add(trimmed);
        return next;
      });
      bufferSetText('');
    } else {
      saveCurrentAnswer(trimmed);
    }
  };

  const handleInputCancel = () => {
    if (isFinished) return;
    bufferSetText('');
    if (activeIndex > 0) setActiveIndex(activeIndex - 1);
  };

  const allAnswered = questions.every((q) => !!answers[q.question]);

  // --- RENDER ---

  if (isFinished) return null;

  if (isReviewing) {
    return (
      <Box flexDirection="column">
        <TabBar
          questions={questions}
          answers={answers}
          activeTabIndex={tabIndex}
        />

        <Box flexDirection="column" marginBottom={1}>
          <Text bold underline>
            Review your answers
          </Text>

          {!allAnswered && (
            <Box marginTop={1}>
              <Text color={theme.status.warning}>
                ⚠ You have not answered all questions
              </Text>
            </Box>
          )}

          <Box flexDirection="column" marginTop={1}>
            {questions
              .filter((q) => !!answers[q.question])
              .map((q, i) => (
                <Box key={i} flexDirection="column" marginBottom={0}>
                  <Box flexDirection="row">
                    <Text color={theme.status.success}> ● </Text>
                    <Text bold color={theme.text.secondary}>
                      {q.question}
                    </Text>
                  </Box>
                  <Text color={theme.text.primary}>
                    {'   '}→ {answers[q.question]}
                  </Text>
                </Box>
              ))}
          </Box>
        </Box>

        <Box flexDirection="column">
          <Text bold>Ready to submit your answers?</Text>
          <Box flexDirection="column" marginTop={1}>
            {submitItems.map((item, index) => {
              const isActive = index === activeIndex;
              return (
                <Box key={item.key} flexDirection="row">
                  <Text
                    color={
                      isActive ? theme.status.success : theme.text.secondary
                    }
                  >
                    {isActive ? '❯ ' : '  '}
                    {index + 1}.{' '}
                  </Text>
                  <Text
                    color={isActive ? theme.status.success : theme.text.primary}
                    bold={isActive}
                  >
                    {item.label}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>
            Enter to select · Tab/Arrow keys to navigate · Esc to back
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
        answers={answers}
        activeTabIndex={tabIndex}
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
          {activeItems.map((item, index) => {
            const isActive = index === activeIndex;
            const isSelected = currentQuestion.multiSelect
              ? multiSelection.has(item.value)
              : false;

            const savedAnswer = answers[currentQuestion.question];
            const isPicked = currentQuestion.multiSelect
              ? isSelected
              : savedAnswer === item.value;

            let checkboxPrefix = '';
            if (currentQuestion.multiSelect) {
              if (item.isDone) {
                checkboxPrefix = '';
              } else {
                checkboxPrefix = isSelected ? '[x] ' : '[ ] ';
              }
            }

            if (item.isOther && isActive) {
              return (
                <Box key={item.key} flexDirection="row">
                  <Text color={theme.status.success}>
                    {isActive ? '❯ ' : '  '}
                    {index + 1}. {checkboxPrefix}
                  </Text>
                  <TextInput
                    buffer={buffer}
                    placeholder="Type something..."
                    onSubmit={handleInputSubmit}
                    onCancel={handleInputCancel}
                    onArrowUp={() => index > 0 && setActiveIndex(index - 1)}
                    onArrowDown={() =>
                      index < activeItems.length - 1 &&
                      setActiveIndex(index + 1)
                    }
                    focus={true}
                  />
                </Box>
              );
            }

            return (
              <Box key={item.key} flexDirection="column" marginBottom={0}>
                <Box flexDirection="row">
                  <Text
                    color={
                      isActive ? theme.status.success : theme.text.secondary
                    }
                  >
                    {isActive ? '❯ ' : '  '}
                    {item.isDone ? '   ' : `${index + 1}. `}
                    {checkboxPrefix}
                    <Text
                      color={
                        isActive || isPicked
                          ? theme.status.success
                          : theme.text.primary
                      }
                      bold
                    >
                      {item.label}
                    </Text>
                    {isPicked &&
                      !currentQuestion.multiSelect &&
                      !item.isDone && (
                        <Text color={theme.status.success}> ✔</Text>
                      )}
                  </Text>
                </Box>
                {item.description && (
                  <Box marginLeft={checkboxPrefix ? 9 : 5}>
                    <Text color={theme.text.secondary} italic>
                      {item.description}
                    </Text>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          Enter to select · Tab/Arrow keys to navigate · Esc to back
        </Text>
      </Box>
    </Box>
  );
};
