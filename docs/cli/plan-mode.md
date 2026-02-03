# Plan Mode

Plan Mode is a specialized mode that enforces a "Think, Research, Plan" workflow
before making any code modifications. When enabled, Gemini CLI restricts the
agent to read-only tools, encouraging thorough research and structured planning
before implementation.

## Overview

Plan Mode helps you:

- **Research thoroughly** - The agent can read files, search code, and gather
  context without accidentally modifying anything
- **Plan before implementing** - Get a clear implementation plan reviewed and
  approved before any code changes
- **Work in parallel** - Read-only tools run without confirmation, enabling
  efficient parallel exploration

## Entering Plan Mode

### Keyboard Toggle

Press **Shift+Tab** to cycle through approval modes:

1. **Default** - Standard mode with confirmation prompts
2. **Auto Edit** - Automatically approve file edits
3. **Planning Mode** - Read-only mode for research and planning

When Plan Mode is active, you'll see a blue **"planning mode"** indicator in the
status bar.

### Command Line

You can start a session directly in Plan Mode:

```bash
gemini --approval-mode plan
```

## How Plan Mode Works

### Allowed Tools (Auto-Approved)

The following tools run without user confirmation in Plan Mode:

| Tool                  | Purpose                                |
| --------------------- | -------------------------------------- |
| `read_file`           | Read individual files                  |
| `read_many_files`     | Read multiple files at once            |
| `search_file_content` | Search code with grep/ripgrep          |
| `glob`                | Find files by pattern                  |
| `list_directory`      | List directory contents                |
| `web_fetch`           | Fetch web content for research         |
| `google_web_search`   | Search the web                         |
| `delegate_to_agent`   | Delegate to sub-agents for exploration |
| `exit_plan_mode`      | Finalize plan and request approval     |
| `write_todos`         | Track planning progress                |

### Blocked Tools (Denied)

These tools are blocked to prevent modifications:

| Tool                | Reason                               |
| ------------------- | ------------------------------------ |
| `replace`           | Modifies file contents               |
| `write_file`        | Creates or overwrites files          |
| `run_shell_command` | Could modify system state            |
| `save_memory`       | Modifies persistent memory           |
| All MCP tools       | External tools may have side effects |

> **Note:** All MCP (external) tools are blocked in Plan Mode regardless of
> their function. This ensures a fully read-only research environment.

### System Prompt

When Plan Mode is active, the agent receives specialized instructions that
emphasize:

- Research the codebase thoroughly before proposing changes
- Use parallel tool calls for efficient exploration
- Create detailed, actionable implementation plans
- Finalize and exit Plan Mode using the `exit_plan_mode` tool

## Managing Plans

### Finalizing a Plan

When you have completed your research and designed an implementation strategy,
you should:

1.  **Write the plan to a file** in the `plans/` directory (e.g.,
    `plans/my-feature.md`). The agent will use `write_file` for this, as it is
    specially allowed for the `plans/` directory in Plan Mode.
2.  **Call `exit_plan_mode`** with the path to your plan file.

When `exit_plan_mode` is called, a confirmation dialog appears with the plan
details.

### The Approval Dialog

The approval dialog provides the following options:

1.  **Approve**: Select an implementation mode (Default or Auto Edit) and
    proceed. The session will automatically switch to the selected mode.
2.  **Reject with Feedback**: Provide feedback to the agent. The session remains
    in Plan Mode, and the agent should revise the plan based on your feedback.
3.  **Cancel**: Discard the tool call and remain in Plan Mode.

### Plan Storage

Plans are stored locally in your project's temporary directory:

```
.gemini/tmp/<hash>/plans/
```

### The `exit_plan_mode` Tool

When the agent completes its research and has written a plan to a file, it uses
the `exit_plan_mode` tool to request approval. This tool accepts:

| Parameter   | Description                                                       |
| ----------- | ----------------------------------------------------------------- |
| `plan_path` | The file path to the finalized plan (e.g., `plans/feature-x.md`). |

When the agent calls this tool, a dialog will appear showing the plan content
and asking for approval.

### Approved Plan Execution

When a plan is approved:

1. The session mode switches to the selected mode (Default or Auto Edit).
2. The agent receives a confirmation that the plan was approved.
3. The agent should then read the plan file and follow it strictly during
   implementation.

## Best Practices

### 1. Start with a Clear Goal

When entering Plan Mode, provide a clear description of what you want to
accomplish. For example:

```
Add a dark mode toggle to the settings page
```

### 2. Let the Agent Research

Allow the agent to read files and search the codebase. The auto-approved
read-only tools enable efficient parallel exploration without interruption.

### 3. Review the Plan

When the agent presents a plan via the `exit_plan_mode` dialog, review:

- **Implementation steps**: Is the approach sound?
- **File paths**: Are these the right files to modify?

### 4. Execute with Context

When you're ready to implement, the plan content becomes context for the agent,
ensuring it follows the researched approach.

## Example Workflow

1. **Enter Plan Mode**

   ```
   Press Shift+Tab until you see "planning mode"
   ```

2. **Describe the Task**

   ```
   Add user authentication with JWT tokens
   ```

3. **Agent Researches**
   - Reads existing auth code
   - Searches for user model
   - Checks dependencies

4. **Agent Finalizes Plan**
   - Writes plan to `plans/auth-implementation.md`
   - Calls `exit_plan_mode` with the path to the plan

5. **Approve Plan via Dialog**
   - **Approve**: Select "Auto Edit" and start implementation
   - **Reject**: Provide feedback for revisions
   - **Cancel**: Discard and stay in Plan Mode

## Troubleshooting

### Agent Tries to Modify Files

If you see "Tool denied" messages, Plan Mode is working correctly. The agent
cannot modify files until you switch modes.

### Tools Still Require Confirmation

In Plan Mode, read-only tools should run without confirmation. If you're still
seeing prompts, check that Plan Mode is active (blue "planning mode" indicator).

## Related Documentation

- [Commands](./commands.md) - All available CLI commands
- [Keyboard Shortcuts](./keyboard-shortcuts.md) - Navigation and mode switching
- [Configuration](./configuration.md) - Approval mode settings
