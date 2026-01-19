# Ask User tool (`ask_user`)

This document describes the `ask_user` tool for the Gemini CLI.

## Description

The `ask_user` tool allows the Gemini agent to ask you structured questions
during execution. This enables the agent to pause its workflow and gather your
input, preferences, or decisions before proceeding.

### Arguments

`ask_user` takes one argument:

- `questions` (array of objects, required): A list of 1-4 questions to ask. Each
  question object includes:
  - `question` (string): The text of the question.
  - `header` (string, optional): A short label or category for the question.
  - `multiSelect` (boolean): Whether you can select multiple options.
  - `options` (array of objects): The available choices. Each option has:
    - `label` (string): The text to display.
    - `description` (string, optional): Additional context for the option.

### Usage

The agent uses this tool when it encounters ambiguity or needs you to make a
choice. For example:

- "Which testing framework do you prefer?"
- "Should I implement this feature using option A or option B?"
- "Which of these files should I update?"

When the tool is called, the CLI displays an interactive form where you can
select one or more options. You can also always choose "Other..." to provide a
custom text response.

## Behavior

- **Interactive:** Execution pauses while you answer the questions.
- **Guided:** The agent provides structured choices to guide your decision, but
  you retain flexibility with the "Other" option.
- **Multiple Questions:** The agent can ask up to 4 related questions in a
  single interaction to minimize interruptions.

Usage example (internal representation):

```javascript
ask_user({
  questions: [
    {
      question: 'Which library should we use for date formatting?',
      header: 'Library',
      multiSelect: false,
      options: [
        { label: 'date-fns', description: 'Modern, lightweight' },
        { label: 'moment', description: 'Legacy, feature-rich' },
      ],
    },
  ],
});
```
