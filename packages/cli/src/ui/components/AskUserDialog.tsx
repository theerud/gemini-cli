/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import type { Question } from '@google/gemini-cli-core';
import { BaseSelectionList } from './shared/BaseSelectionList.js';
import type { SelectionListItem } from '../hooks/useSelectionList.js';
import { useKeypress, type Key } from '../hooks/useKeypress.js';

interface AskUserDialogProps {
  questions: Question[];
  onSubmit: (answers: { [questionIndex: string]: string }) => void;
  onCancel: () => void;
  onActiveTextInputChange?: (active: boolean) => void;
}

// ============== Text Question View ==============

interface TextQuestionViewProps {
  question: Question;
  onAnswer: (answer: string) => void;
  onSelectionChange?: (answer: string) => void;
  onEditingCustomOption?: (editing: boolean) => void;
  initialAnswer?: string;
  progressHeader?: React.ReactNode;
  keyboardHints?: React.ReactNode;
}

const TextQuestionView: React.FC<TextQuestionViewProps> = ({
  question,
  onAnswer,
  onSelectionChange,
  onEditingCustomOption,
  initialAnswer,
  progressHeader,
  keyboardHints,
}) => {
  const [textValue, setTextValue] = useState(initialAnswer || '');

  const handleTextTyping = useCallback(
    (key: Key) => {
      // Handle Ctrl+C to clear all text
      if (key.ctrl && key.name === 'c') {
        setTextValue('');
        onSelectionChange?.('');
        return;
      }

      // Handle backspace
      if (key.name === 'backspace' || key.name === 'delete') {
        const newText = textValue.slice(0, -1);
        setTextValue(newText);
        onSelectionChange?.(newText);
        return;
      }

      // Handle Enter to submit
      if (key.name === 'return') {
        if (textValue.trim()) {
          onAnswer(textValue.trim());
        }
        return;
      }

      // Handle printable characters
      if (
        key.sequence &&
        key.sequence.length === 1 &&
        !key.ctrl &&
        !key.cmd &&
        key.sequence.charCodeAt(0) >= 32
      ) {
        const newText = textValue + key.sequence;
        setTextValue(newText);
        onSelectionChange?.(newText);
        onEditingCustomOption?.(true);
      }
    },
    [textValue, onAnswer, onSelectionChange, onEditingCustomOption],
  );

  useKeypress(handleTextTyping, { isActive: true });

  // Notify parent that we're in text input mode (for Ctrl+C handling)
  useEffect(() => {
    onEditingCustomOption?.(true);
    return () => {
      onEditingCustomOption?.(false);
    };
  }, [onEditingCustomOption]);

  const placeholder = question.placeholder || 'Enter your response';
  const showPlaceholder = !textValue;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      paddingX={1}
      borderColor={theme.border.default}
    >
      {progressHeader}
      <Box marginBottom={1}>
        <Text bold color={theme.text.primary}>
          {question.question}
        </Text>
      </Box>

      <Box flexDirection="row" marginBottom={1}>
        <Text color={theme.text.accent}>{'> '}</Text>
        {showPlaceholder ? (
          <Text color={theme.text.secondary} italic>
            <Text color={theme.text.accent}>{'|'}</Text>
            {placeholder}
          </Text>
        ) : (
          <Text color={theme.text.primary}>
            {textValue}
            <Text color={theme.text.accent}>{'|'}</Text>
          </Text>
        )}
      </Box>

      {keyboardHints}
    </Box>
  );
};

// ============== Choice Question View ==============

interface OptionItem {
  key: string;
  label: string;
  description: string;
  type: 'option' | 'other' | 'done';
  index: number;
}

interface ChoiceQuestionViewProps {
  question: Question;
  onAnswer: (answer: string) => void;
  onSelectionChange?: (answer: string) => void;
  onEditingCustomOption?: (editing: boolean) => void;
  initialAnswer?: string;
  progressHeader?: React.ReactNode;
  keyboardHints?: React.ReactNode;
}

const ChoiceQuestionView: React.FC<ChoiceQuestionViewProps> = ({
  question,
  onAnswer,
  onSelectionChange,
  onEditingCustomOption,
  initialAnswer,
  progressHeader,
  keyboardHints,
}) => {
  const questionOptions = useMemo(
    () => question.options ?? [],
    [question.options],
  );
  // Initialize state from initialAnswer if returning to a previously answered question
  const initialState = useMemo(() => {
    if (!initialAnswer) {
      return {
        selectedIndices: new Set<number>(),
        customOptionText: '',
        isCustomOptionSelected: false,
      };
    }

    // Check if initialAnswer matches any option labels
    const selectedIndices = new Set<number>();
    let customOptionText = '';
    let isCustomOptionSelected = false;

    if (question.multiSelect) {
      const answers = initialAnswer.split(', ');
      answers.forEach((answer) => {
        const index = questionOptions.findIndex((opt) => opt.label === answer);
        if (index !== -1) {
          selectedIndices.add(index);
        } else {
          customOptionText = answer;
          isCustomOptionSelected = true;
        }
      });
    } else {
      const index = questionOptions.findIndex(
        (opt) => opt.label === initialAnswer,
      );
      if (index !== -1) {
        selectedIndices.add(index);
      } else {
        customOptionText = initialAnswer;
        isCustomOptionSelected = true;
      }
    }

    return { selectedIndices, customOptionText, isCustomOptionSelected };
  }, [initialAnswer, questionOptions, question.multiSelect]);

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    initialState.selectedIndices,
  );
  const [customOptionText, setCustomOptionText] = useState(
    initialState.customOptionText,
  );
  const [isCustomOptionSelected, setIsCustomOptionSelected] = useState(
    initialState.isCustomOptionSelected,
  );
  const [isCustomOptionFocused, setIsCustomOptionFocused] = useState(false);

  // Helper to build answer string from selections
  const buildAnswerString = useCallback(
    (
      indices: Set<number>,
      includeCustomOption: boolean,
      customOption: string,
    ) => {
      const answers: string[] = [];
      questionOptions.forEach((opt, i) => {
        if (indices.has(i)) {
          answers.push(opt.label);
        }
      });
      if (includeCustomOption && customOption.trim()) {
        answers.push(customOption.trim());
      }
      return answers.join(', ');
    },
    [questionOptions],
  );

  // Handle inline typing when custom option is focused
  const handleCustomOptionTyping = useCallback(
    (key: Key) => {
      if (!isCustomOptionFocused) return;

      // Handle Ctrl+C to clear all text
      if (key.ctrl && key.name === 'c') {
        setCustomOptionText('');
        setIsCustomOptionSelected(false);
        // Save for multi-select
        if (question.multiSelect) {
          onSelectionChange?.(buildAnswerString(selectedIndices, false, ''));
        }
        return;
      }

      // Handle backspace
      if (key.name === 'backspace' || key.name === 'delete') {
        const newText = customOptionText.slice(0, -1);
        setCustomOptionText(newText);
        const newIsCustomOptionSelected = newText.length > 0;
        if (!newIsCustomOptionSelected) {
          setIsCustomOptionSelected(false);
        }
        // Save for multi-select
        if (question.multiSelect) {
          onSelectionChange?.(
            buildAnswerString(
              selectedIndices,
              newIsCustomOptionSelected,
              newText,
            ),
          );
        }
        return;
      }

      // Handle printable characters (ignore control keys)
      if (
        key.sequence &&
        key.sequence.length === 1 &&
        !key.ctrl &&
        !key.cmd &&
        key.sequence.charCodeAt(0) >= 32
      ) {
        const newText = customOptionText + key.sequence;
        setCustomOptionText(newText);
        // Only mark as selected in multi-select mode (for single-select, green/checkmark
        // should only appear for previously submitted answers from initialAnswer)
        if (question.multiSelect) {
          setIsCustomOptionSelected(true);
          // Save immediately so navigation preserves it
          onSelectionChange?.(
            buildAnswerString(selectedIndices, true, newText),
          );
        }
        onEditingCustomOption?.(true);
      }
    },
    [
      isCustomOptionFocused,
      customOptionText,
      onEditingCustomOption,
      question.multiSelect,
      onSelectionChange,
      buildAnswerString,
      selectedIndices,
    ],
  );

  useKeypress(handleCustomOptionTyping, { isActive: isCustomOptionFocused });

  const selectionItems = useMemo((): Array<SelectionListItem<OptionItem>> => {
    const list: Array<SelectionListItem<OptionItem>> = questionOptions.map(
      (opt, i) => {
        const item: OptionItem = {
          key: `opt-${i}`,
          label: opt.label,
          description: opt.description,
          type: 'option',
          index: i,
        };
        return { key: item.key, value: item };
      },
    );

    // Only add custom option for choice type, not yesno
    if (question.type !== 'yesno') {
      const otherItem: OptionItem = {
        key: 'other',
        label: customOptionText || '',
        description: '',
        type: 'other',
        index: list.length,
      };
      list.push({ key: otherItem.key, value: otherItem });
    }

    if (question.multiSelect) {
      const doneItem: OptionItem = {
        key: 'done',
        label: 'Done',
        description: 'Finish selection',
        type: 'done',
        index: list.length,
      };
      list.push({ key: doneItem.key, value: doneItem, hideNumber: true });
    }

    return list;
  }, [questionOptions, question.multiSelect, question.type, customOptionText]);

  const handleHighlight = useCallback(
    (itemValue: OptionItem) => {
      const nowFocusingCustomOption = itemValue.type === 'other';
      setIsCustomOptionFocused(nowFocusingCustomOption);
      // Notify parent when we stop focusing custom option (so navigation can resume)
      if (!nowFocusingCustomOption) {
        onEditingCustomOption?.(false);
      }
    },
    [onEditingCustomOption],
  );

  const handleSelect = useCallback(
    (itemValue: OptionItem) => {
      // console.log('handleSelect called with:', itemValue);
      if (question.multiSelect) {
        if (itemValue.type === 'option') {
          const newIndices = new Set(selectedIndices);
          if (newIndices.has(itemValue.index)) {
            newIndices.delete(itemValue.index);
          } else {
            newIndices.add(itemValue.index);
          }
          setSelectedIndices(newIndices);
          // Save selection immediately so navigation preserves it
          onSelectionChange?.(
            buildAnswerString(
              newIndices,
              isCustomOptionSelected,
              customOptionText,
            ),
          );
        } else if (itemValue.type === 'other') {
          // Toggle other selection
          if (customOptionText.trim()) {
            const newIsCustomOptionSelected = !isCustomOptionSelected;
            setIsCustomOptionSelected(newIsCustomOptionSelected);
            // Save selection immediately
            onSelectionChange?.(
              buildAnswerString(
                selectedIndices,
                newIsCustomOptionSelected,
                customOptionText,
              ),
            );
          }
        } else if (itemValue.type === 'done') {
          // Done just triggers navigation, selections already saved
          onAnswer(
            buildAnswerString(
              selectedIndices,
              isCustomOptionSelected,
              customOptionText,
            ),
          );
        }
      } else {
        if (itemValue.type === 'option') {
          onAnswer(itemValue.label);
        } else if (itemValue.type === 'other') {
          // Submit the other text if it has content
          if (customOptionText.trim()) {
            // Reset editing state before submitting so navigation works on next question
            onEditingCustomOption?.(false);
            onAnswer(customOptionText.trim());
          }
        }
      }
    },
    [
      question.multiSelect,
      selectedIndices,
      isCustomOptionSelected,
      customOptionText,
      onAnswer,
      onEditingCustomOption,
      onSelectionChange,
      buildAnswerString,
    ],
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      paddingX={1}
      borderColor={theme.border.default}
    >
      {progressHeader}
      <Box marginBottom={1}>
        <Text bold color={theme.text.primary}>
          {question.question}
        </Text>
      </Box>
      {question.multiSelect && (
        <Text color={theme.text.secondary} italic>
          {' '}
          (Select all that apply)
        </Text>
      )}

      <BaseSelectionList<OptionItem>
        items={selectionItems}
        onSelect={handleSelect}
        onHighlight={handleHighlight}
        selectedColor={theme.text.accent}
        renderItem={(item, context) => {
          const optionItem = item.value;
          const isChecked =
            selectedIndices.has(optionItem.index) ||
            (optionItem.type === 'other' && isCustomOptionSelected);
          const showCheck =
            question.multiSelect &&
            (optionItem.type === 'option' || optionItem.type === 'other');

          // Render inline text input for custom option
          if (optionItem.type === 'other') {
            const displayText = customOptionText || '';
            const placeholder = 'Enter a custom value';
            const showPlaceholder = !displayText && context.isSelected;
            const showCursor = context.isSelected;
            return (
              <Box flexDirection="column">
                <Box flexDirection="row">
                  {showCheck && (
                    <Text
                      color={
                        isChecked ? theme.text.accent : theme.text.secondary
                      }
                    >
                      [{isChecked ? 'x' : ' '}]
                    </Text>
                  )}
                  <Text color={theme.text.primary}> </Text>
                  {showPlaceholder ? (
                    <Text color={theme.text.secondary} italic>
                      <Text color={theme.text.accent}>
                        {showCursor ? '▌' : ''}
                      </Text>
                      {placeholder}
                    </Text>
                  ) : (
                    <Text
                      color={
                        isChecked && !question.multiSelect
                          ? theme.status.success
                          : displayText
                            ? theme.text.primary
                            : theme.text.secondary
                      }
                    >
                      {displayText || (context.isSelected ? '' : placeholder)}
                      {showCursor && <Text color={theme.text.accent}>▌</Text>}
                    </Text>
                  )}
                  {isChecked && !question.multiSelect && (
                    <Text color={theme.status.success}> ✓</Text>
                  )}
                </Box>
              </Box>
            );
          }

          // Determine label color: checked (previously answered) uses success, selected uses accent, else primary
          const labelColor =
            isChecked && !question.multiSelect
              ? theme.status.success
              : context.isSelected
                ? context.titleColor
                : theme.text.primary;

          return (
            <Box flexDirection="column">
              <Box flexDirection="row">
                {showCheck && (
                  <Text
                    color={isChecked ? theme.text.accent : theme.text.secondary}
                  >
                    [{isChecked ? 'x' : ' '}]
                  </Text>
                )}
                <Text color={labelColor} bold={optionItem.type === 'done'}>
                  {' '}
                  {optionItem.label}
                </Text>
                {isChecked && !question.multiSelect && (
                  <Text color={theme.status.success}> ✓</Text>
                )}
              </Box>
              {optionItem.description && (
                <Text color={theme.text.secondary} wrap="wrap">
                  {' '}
                  {optionItem.description}
                </Text>
              )}
            </Box>
          );
        }}
      />
      {keyboardHints}
    </Box>
  );
};

interface SubmitViewProps {
  questions: Question[];
  answers: { [key: string]: string };
  onSubmit: () => void;
  onCancel: () => void;
  progressHeader: React.ReactNode;
  keyboardHints: React.ReactNode;
}

const SubmitView: React.FC<SubmitViewProps> = ({
  questions,
  answers,
  onSubmit,
  onCancel,
  progressHeader,
  keyboardHints,
}) => {
  const allAnswered = questions.every(
    (_, i) => answers[i] && answers[i].trim() !== '',
  );

  interface SubmitOption {
    label: string;
    action: 'submit' | 'cancel';
  }

  const options: Array<SelectionListItem<SubmitOption>> = [
    {
      key: 'submit',
      value: { label: 'Submit answers', action: 'submit' },
    },
    {
      key: 'cancel',
      value: { label: 'Cancel', action: 'cancel' },
    },
  ];

  const handleSelect = (option: SubmitOption) => {
    if (option.action === 'submit') {
      if (allAnswered) {
        onSubmit();
      }
    } else {
      onCancel();
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      paddingX={1}
      borderColor={theme.border.default}
    >
      {progressHeader}
      <Box marginBottom={1}>
        <Text bold color={theme.text.primary}>
          Review your answers
        </Text>
      </Box>

      {!allAnswered && (
        <Box marginBottom={1}>
          <Text color={theme.status.warning}>
            ⚠ You have not answered all questions
          </Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        {questions.map((q, i) => {
          const answer = answers[i];
          if (!answer || answer.trim() === '') return null;
          return (
            <Box key={i} flexDirection="column" marginBottom={0}>
              <Text color={theme.text.primary}>● {q.question}</Text>
              <Text color={theme.text.secondary}>
                {'   → '}
                {answer}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box marginBottom={1}>
        <Text color={theme.text.primary}>Ready to submit your answers?</Text>
      </Box>

      <BaseSelectionList
        items={options}
        onSelect={handleSelect}
        selectedColor={theme.text.accent}
        renderItem={(item, context) => (
          <Text
            color={
              item.value.action === 'submit' &&
              !allAnswered &&
              context.isSelected
                ? theme.status.warning
                : context.isSelected
                  ? theme.text.accent
                  : theme.text.primary
            }
          >
            {item.value.label}
          </Text>
        )}
      />
      {keyboardHints}
    </Box>
  );
};

export const AskUserDialog: React.FC<AskUserDialogProps> = ({
  questions,
  onSubmit,
  onCancel,
  onActiveTextInputChange,
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [isEditingCustomOption, setIsEditingCustomOption] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Use ref for synchronous check to prevent race conditions during unmount
  const submittedRef = useRef(false);
  const isEditingCustomOptionRef = useRef(false);
  isEditingCustomOptionRef.current = isEditingCustomOption;

  // Sync isEditingCustomOption state with parent for global keypress handling
  // Clean up on unmount to ensure Ctrl+C works normally after dialog closes
  useEffect(() => {
    onActiveTextInputChange?.(isEditingCustomOption);
    return () => {
      onActiveTextInputChange?.(false);
    };
  }, [isEditingCustomOption, onActiveTextInputChange]);

  // Handle Escape or Ctrl+C to cancel (but not Ctrl+C when editing custom option)
  const handleCancel = useCallback(
    (key: Key) => {
      if (submittedRef.current) return;
      if (key.name === 'escape') {
        onCancel();
      } else if (
        key.ctrl &&
        key.name === 'c' &&
        !isEditingCustomOptionRef.current
      ) {
        onCancel();
      }
    },
    [onCancel],
  );

  useKeypress(handleCancel, {
    isActive: !submitted,
  });

  // Bidirectional navigation between questions using custom useKeypress for consistency
  const handleNavigation = useCallback(
    (key: Key) => {
      // Allow navigation for text-type questions even when "editing"
      // (isEditingCustomOption blocks navigation for choice-type custom option field, not text-type questions)
      const currentQuestionIsText =
        questions[currentQuestionIndex]?.type === 'text';
      if (
        (isEditingCustomOption && !currentQuestionIsText) ||
        submittedRef.current
      )
        return;

      const maxIndex = questions.length > 1 ? questions.length : 0;

      if (key.name === 'tab' || key.name === 'right') {
        if (currentQuestionIndex < maxIndex) {
          setCurrentQuestionIndex((prev) => prev + 1);
        }
      } else if (key.name === 'left') {
        if (currentQuestionIndex > 0) {
          setCurrentQuestionIndex((prev) => prev - 1);
        }
      }
    },
    [isEditingCustomOption, currentQuestionIndex, questions],
  );

  useKeypress(handleNavigation, {
    isActive: !submitted,
  });

  const handleAnswer = useCallback(
    (answer: string) => {
      if (submittedRef.current) return;

      // Only record non-empty answers
      const hasAnswer = answer && answer.trim();
      const newAnswers = hasAnswer
        ? { ...answers, [currentQuestionIndex]: answer }
        : answers;
      if (hasAnswer) {
        setAnswers(newAnswers);
      }

      const maxIndex = questions.length > 1 ? questions.length : 0;

      if (currentQuestionIndex < maxIndex) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else if (currentQuestionIndex === 0 && questions.length === 1) {
        // Single question case - direct submit
        submittedRef.current = true;
        setSubmitted(true);
        onSubmit(newAnswers);
      }
    },
    [currentQuestionIndex, questions.length, answers, onSubmit],
  );

  const handleSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    onSubmit(answers);
  }, [answers, onSubmit]);

  // Save multi-select selections without triggering navigation
  const handleSelectionChange = useCallback(
    (answer: string) => {
      if (submittedRef.current) return;
      const hasAnswer = answer && answer.trim();
      if (hasAnswer) {
        setAnswers((prev) => ({ ...prev, [currentQuestionIndex]: answer }));
      } else {
        // Remove empty answer from state
        setAnswers((prev) => {
          const next = { ...prev };
          delete next[currentQuestionIndex];
          return next;
        });
      }
    },
    [currentQuestionIndex],
  );

  const answeredIndices = useMemo(
    () => new Set(Object.keys(answers).map(Number)),
    [answers],
  );

  const isSubmitTab = currentQuestionIndex === questions.length;
  const currentQuestion = questions[currentQuestionIndex];

  // Progress header including Submit tab
  const progressHeader =
    questions.length > 1 ? (
      <Box flexDirection="row" marginBottom={1}>
        <Text color={theme.text.secondary}>{'← '}</Text>
        {questions.map((q, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Text color={theme.text.secondary}>{' │ '}</Text>}
            <Text color={theme.text.secondary}>
              {answeredIndices.has(i) ? '☒' : '☐'}{' '}
            </Text>
            <Text
              color={
                i === currentQuestionIndex
                  ? theme.text.accent
                  : theme.text.secondary
              }
              bold={i === currentQuestionIndex}
            >
              {q.header}
            </Text>
          </React.Fragment>
        ))}
        <Text color={theme.text.secondary}>{' │ '}</Text>
        <Text color={theme.text.secondary}>{'✔ '}</Text>
        <Text
          color={
            currentQuestionIndex === questions.length
              ? theme.text.accent
              : theme.text.secondary
          }
          bold={currentQuestionIndex === questions.length}
        >
          Submit
        </Text>
        <Text color={theme.text.secondary}>{' →'}</Text>
      </Box>
    ) : null;

  const keyboardHints = (
    <Box marginTop={1}>
      <Text color={theme.text.secondary}>
        {currentQuestion?.type === 'text'
          ? questions.length > 1
            ? 'Enter to submit · ←/→ to switch questions · Esc to cancel'
            : 'Enter to submit · Esc to cancel'
          : questions.length > 1
            ? 'Enter to select · ←/→ to switch questions · Esc to cancel'
            : 'Enter to select · ↑/↓ to navigate · Esc to cancel'}
      </Text>
    </Box>
  );

  if (isSubmitTab && questions.length > 1) {
    return (
      <SubmitView
        questions={questions}
        answers={answers}
        onSubmit={handleSubmit}
        onCancel={onCancel}
        progressHeader={progressHeader}
        keyboardHints={keyboardHints}
      />
    );
  }

  // Safeguard for invalid question index
  if (!currentQuestion) return null;

  // Render text-type or choice-type question view
  if (currentQuestion.type === 'text') {
    return (
      <TextQuestionView
        key={currentQuestionIndex}
        question={currentQuestion}
        onAnswer={handleAnswer}
        onSelectionChange={handleSelectionChange}
        onEditingCustomOption={setIsEditingCustomOption}
        initialAnswer={answers[currentQuestionIndex]}
        progressHeader={progressHeader}
        keyboardHints={keyboardHints}
      />
    );
  }

  // For yesno type, generate Yes/No options and force single-select
  const effectiveQuestion =
    currentQuestion.type === 'yesno'
      ? {
          ...currentQuestion,
          options: [
            { label: 'Yes', description: '' },
            { label: 'No', description: '' },
          ],
          multiSelect: false,
        }
      : currentQuestion;

  return (
    <ChoiceQuestionView
      key={currentQuestionIndex}
      question={effectiveQuestion}
      onAnswer={handleAnswer}
      onSelectionChange={handleSelectionChange}
      onEditingCustomOption={setIsEditingCustomOption}
      initialAnswer={answers[currentQuestionIndex]}
      progressHeader={progressHeader}
      keyboardHints={keyboardHints}
    />
  );
};
