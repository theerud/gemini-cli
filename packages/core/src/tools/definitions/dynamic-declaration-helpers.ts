/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reusable logic for generating tool declarations that depend on runtime state
 * (OS, platforms, or dynamic schema values like available skills).
 */

import { type FunctionDeclaration } from '@google/genai';
import * as os from 'node:os';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  SHELL_TOOL_NAME,
  EXIT_PLAN_MODE_TOOL_NAME,
  ACTIVATE_SKILL_TOOL_NAME,
  READ_FILE_TOOL_NAME,
  EDIT_TOOL_NAME,
} from './base-declarations.js';

/**
 * Generates the platform-specific description for the shell tool.
 */
export function getShellToolDescription(
  enableInteractiveShell: boolean,
  enableEfficiency: boolean,
): string {
  const efficiencyGuidelines = enableEfficiency
    ? `

      Efficiency Guidelines:
      - Quiet Flags: Always prefer silent or quiet flags (e.g., \`npm install --silent\`, \`git --no-pager\`) to reduce output volume while still capturing necessary information.
      - Pagination: Always disable terminal pagination to ensure commands terminate (e.g., use \`git --no-pager\`, \`systemctl --no-pager\`, or set \`PAGER=cat\`).`
    : '';

  const returnedInfo = `

      The following information is returned:

      Output: Combined stdout/stderr. Can be \`(empty)\` or partial on error and for any unwaited background processes.
      Exit Code: Only included if non-zero (command failed).
      Error: Only included if a process-level error occurred (e.g., spawn failure).
      Signal: Only included if process was terminated by a signal.
      Background PIDs: Only included if background processes were started.
      Process Group PGID: Only included if available.`;

  const confirmationNote = `

      The CLI will automatically prompt the user for confirmation before executing any command provided by this tool, so you MUST NOT ask for permission or confirmation separately (e.g., using ask_user).`;

  if (os.platform() === 'win32') {
    const backgroundInstructions = enableInteractiveShell
      ? 'To run a command in the background, set the `is_background` parameter to true. Do NOT use PowerShell background constructs.'
      : 'Command can start background processes using PowerShell constructs such as `Start-Process -NoNewWindow` or `Start-Job`.';
    return `This tool executes a given shell command as \`powershell.exe -NoProfile -Command <command>\`. ${backgroundInstructions}${confirmationNote}${efficiencyGuidelines}${returnedInfo}`;
  } else {
    const backgroundInstructions = enableInteractiveShell
      ? 'To run a command in the background, set the `is_background` parameter to true. Do NOT use `&` to background commands.'
      : 'Command can start background processes using `&`.';
    return `This tool executes a given shell command as \`bash -c <command>\`. ${backgroundInstructions} Command is executed as a subprocess that leads its own process group. Command process group can be terminated as \`kill -- -PGID\` or signaled as \`kill -s SIGNAL -- -PGID\`.${confirmationNote}${efficiencyGuidelines}${returnedInfo}`;
  }
}

/**
 * Returns the platform-specific description for the 'command' parameter.
 */
export function getCommandDescription(): string {
  if (os.platform() === 'win32') {
    return 'Exact command to execute as `powershell.exe -NoProfile -Command <command>`';
  }
  return 'Exact bash command to execute as `bash -c <command>`';
}

/**
 * Returns the FunctionDeclaration for the read_file tool.
 */
export function getReadFileDeclaration(
  enableHashline: boolean,
  descriptionOverride?: string,
): FunctionDeclaration {
  const description =
    descriptionOverride ||
    `Reads and returns the content of a specified file. If the file is large, the content will be truncated. The tool's response will clearly indicate if truncation has occurred and will provide details on how to read more of the file using the 'start_line' and 'end_line' parameters. Handles text, images (PNG, JPG, GIF, WEBP, SVG, BMP), audio files (MP3, WAV, AIFF, AAC, OGG, FLAC), and PDF files. For text files, it can read specific line ranges.`;

  const properties: Record<string, unknown> = {
    file_path: {
      description: 'The path to the file to read.',
      type: 'string',
    },
    start_line: {
      description: 'Optional: The 1-based line number to start reading from.',
      type: 'number',
    },
    end_line: {
      description:
        'Optional: The 1-based line number to end reading at (inclusive).',
      type: 'number',
    },
  };

  if (enableHashline) {
    properties['include_hashes'] = {
      description:
        'Optional: If true, returned content will include Hashline identifiers (INDEX#HASH:) for each line.',
      type: 'boolean',
    };
  }

  return {
    name: READ_FILE_TOOL_NAME,
    description: enableHashline
      ? description +
        '\n\nSet `include_hashes: true` to obtain line identifiers (LINE#HASH) for use with the precision `line_edits` mode in the `replace` tool.'
      : description,
    parametersJsonSchema: {
      type: 'object',
      properties,
      required: ['file_path'],
    },
  };
}

/**
 * Returns the FunctionDeclaration for the replace tool.
 */
export function getReplaceDeclaration(
  enableHashline: boolean,
  descriptionOverride?: string,
): FunctionDeclaration {
  const description =
    descriptionOverride ||
    `Replaces text within a file. By default, the tool expects to find and replace exactly ONE occurrence of \`old_string\`. If you want to replace multiple occurrences of the exact same string, set \`allow_multiple\` to true. This tool requires providing significant context around the change to ensure precise targeting. Always use the ${READ_FILE_TOOL_NAME} tool to examine the file's current content before attempting a text replacement.

      The user has the ability to modify the \`new_string\` content. If modified, this will be stated in the response.

      Expectation for required parameters:
      1. \`old_string\` MUST be the exact literal text to replace (including all whitespace, indentation, newlines, and surrounding code etc.).
      2. \`new_string\` MUST be the exact literal text to replace \`old_string\` with (also including all whitespace, indentation, newlines, and surrounding code etc.). Ensure the resulting code is correct and idiomatic and that \`old_string\` and \`new_string\` are different.
      3. \`instruction\` is the detailed instruction of what needs to be changed. It is important to Make it specific and detailed so developers or large language models can understand what needs to be changed and perform the changes on their own if necessary. 
      4. NEVER escape \`old_string\` or \`new_string\`, that would break the exact literal text requirement.
      **Important:** If ANY of the above are not satisfied, the tool will fail. CRITICAL for \`old_string\`: Must uniquely identify the instance(s) to change. Include at least 3 lines of context BEFORE and AFTER the target text, matching whitespace and indentation precisely. If this string matches multiple locations and \`allow_multiple\` is not true, the tool will fail.
      5. Prefer to break down complex and long changes into multiple smaller atomic calls to this tool. Always check the content of the file after changes or not finding a string to match.
      **Multiple replacements:** Set \`allow_multiple\` to true if you want to replace ALL occurrences that match \`old_string\` exactly.`;

  const properties: Record<string, unknown> = {
    file_path: {
      description: 'The path to the file to modify.',
      type: 'string',
    },
    instruction: {
      description: `A clear, semantic instruction for the code change, acting as a high-quality prompt for an expert LLM assistant. It must be self-contained and explain the goal of the change.

A good instruction should concisely answer:
1.  WHY is the change needed? (e.g., "To fix a bug where users can be null...")
2.  WHERE should the change happen? (e.g., "...in the 'renderUserProfile' function...")
3.  WHAT is the high-level change? (e.g., "...add a null check for the 'user' object...")
4.  WHAT is the desired outcome? (e.g., "...so that it displays a loading spinner instead of crashing.")

**GOOD Example:** "In the 'calculateTotal' function, correct the sales tax calculation by updating the 'taxRate' constant from 0.05 to 0.075 to reflect the new regional tax laws."

**BAD Examples:**
- "Change the text." (Too vague)
- "Fix the bug." (Doesn't explain the bug or the fix)
- "Replace the line with this new line." (Brittle, just repeats the other parameters)
`,
      type: 'string',
    },
    old_string: {
      description:
        'The exact literal text to replace, preferably unescaped. For single replacements (default), include at least 3 lines of context BEFORE and AFTER the target text, matching whitespace and indentation precisely. If this string is not the exact literal text (i.e. you escaped it) or does not match exactly, the tool will fail.',
      type: 'string',
    },
    new_string: {
      description:
        "The exact literal text to replace `old_string` with, preferably unescaped. Provide the EXACT text. Ensure the resulting code is correct and idiomatic. Do not use omission placeholders like '(rest of methods ...)', '...', or 'unchanged code'; provide exact literal code.",
      type: 'string',
    },
    allow_multiple: {
      type: 'boolean',
      description:
        'If true, the tool will replace all occurrences of `old_string`. If false (default), it will only succeed if exactly one occurrence is found.',
    },
  };

  if (enableHashline) {
    properties['line_edits'] = {
      type: 'array',
      description:
        'Optional: Line-based edits using Hashline identifiers (e.g., ["42#WS3"]). If provided, the tool will prioritize these and skip string-based matching. Edits are applied as an atomic transaction.',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description:
              'The Hashline ID of the line to edit (e.g., "42#WS3").',
          },
          new_content: {
            type: 'string',
            description: 'The new content for this line.',
          },
        },
        required: ['id', 'new_content'],
      },
    };
  }

  const required = ['file_path', 'instruction'];
  if (!enableHashline) {
    required.push('old_string', 'new_string');
  }

  return {
    name: EDIT_TOOL_NAME,
    description: enableHashline
      ? description +
        '\n\nUse the `line_edits` parameter with Hashline identifiers (obtained from `read_file`) for precise, atomic edits that avoid whitespace and context-matching errors.'
      : description,
    parametersJsonSchema: {
      type: 'object',
      properties,
      required,
    },
  };
}
/**
 * Returns the FunctionDeclaration for the shell tool.
 */
export function getShellDeclaration(
  enableInteractiveShell: boolean,
  enableEfficiency: boolean,
): FunctionDeclaration {
  return {
    name: SHELL_TOOL_NAME,
    description: getShellToolDescription(
      enableInteractiveShell,
      enableEfficiency,
    ),
    parametersJsonSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: getCommandDescription(),
        },
        description: {
          type: 'string',
          description:
            'Brief description of the command for the user. Be specific and concise. Ideally a single sentence. Can be up to 3 sentences for clarity. No line breaks.',
        },
        dir_path: {
          type: 'string',
          description:
            '(OPTIONAL) The path of the directory to run the command in. If not provided, the project root directory is used. Must be a directory within the workspace and must already exist.',
        },
        is_background: {
          type: 'boolean',
          description:
            'Set to true if this command should be run in the background (e.g. for long-running servers or watchers). The command will be started, allowed to run for a brief moment to check for immediate errors, and then moved to the background.',
        },
      },
      required: ['command'],
    },
  };
}

/**
 * Returns the FunctionDeclaration for exiting plan mode.
 */
export function getExitPlanModeDeclaration(
  plansDir: string,
): FunctionDeclaration {
  return {
    name: EXIT_PLAN_MODE_TOOL_NAME,
    description:
      'Finalizes the planning phase and transitions to implementation by presenting the plan for user approval. This tool MUST be used to exit Plan Mode before any source code edits can be performed. Call this whenever a plan is ready or the user requests implementation.',
    parametersJsonSchema: {
      type: 'object',
      required: ['plan_path'],
      properties: {
        plan_path: {
          type: 'string',
          description: `The file path to the finalized plan (e.g., "${plansDir}/feature-x.md"). This path MUST be within the designated plans directory: ${plansDir}/`,
        },
      },
    },
  };
}

/**
 * Returns the FunctionDeclaration for activating a skill.
 */
export function getActivateSkillDeclaration(
  skillNames: string[],
): FunctionDeclaration {
  const availableSkillsHint =
    skillNames.length > 0
      ? ` (Available: ${skillNames.map((n) => `'${n}'`).join(', ')})`
      : '';

  let schema: z.ZodTypeAny;
  if (skillNames.length === 0) {
    schema = z.object({
      name: z.string().describe('No skills are currently available.'),
    });
  } else {
    schema = z.object({
      name: z
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        .enum(skillNames as [string, ...string[]])
        .describe('The name of the skill to activate.'),
    });
  }

  return {
    name: ACTIVATE_SKILL_TOOL_NAME,
    description: `Activates a specialized agent skill by name${availableSkillsHint}. Returns the skill's instructions wrapped in \`<activated_skill>\` tags. These provide specialized guidance for the current task. Use this when you identify a task that matches a skill's description. ONLY use names exactly as they appear in the \`<available_skills>\` section.`,
    parametersJsonSchema: zodToJsonSchema(schema),
  };
}
