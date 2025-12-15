# Exit Plan Mode tool (`exit_plan_mode`)

This document describes the `exit_plan_mode` tool for the Gemini CLI.

## Purpose

The `exit_plan_mode` tool is used by the agent to autonomously exit "Plan Mode"
and return to the default operating mode where it can execute write operations.

## Plan Mode

**Plan Mode** is a safety state where the agent is restricted to read-only
operations (like reading files, searching code, and fetching web pages). Write
operations (like writing files or editing code) are strictly prohibited. Shell
commands require explicit user approval.

This mode allows the agent to safely research, investigate, and formulate a
comprehensive plan for complex tasks without the risk of making accidental or
premature changes to the codebase.

You can enter Plan Mode by:

- Running the `/plan-mode` slash command.
- Pressing `Shift+Tab` to cycle through modes until "Plan Mode" is active.

## Tool Usage

The agent uses this tool when it has completed its research and planning phase
and is ready to begin implementation.

### Technical Implementation

- **Trigger:** The agent calls this tool when it decides it is ready to code.
- **Action:** The tool switches the CLI's approval mode from `PLAN_MODE` back to
  `DEFAULT`.
- **Validation:** The tool prompts the agent to ensure the plan is clear and
  unambiguous before exiting.

### Parameters

- `plan` (string, required): The implementation plan the agent has formulated.
  This serves as a confirmation of the work to be done.

```json
{
  "plan": "1. Create file A. 2. Edit file B..."
}
```
