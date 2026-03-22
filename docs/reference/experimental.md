# Experimental Features

This document describes experimental features available in Gemini CLI. These
features are in active development and may change or be removed in future
versions.

## Hashline Protocol

**Status**: Experimental (Disabled by default) **Configuration**:
`experimental.enableHashline`

The **Hashline Protocol** is a new method for reading and editing files that
uses content-anchored line identifiers (`LINE#HASH`) instead of traditional
string matching or line numbers.

### Why use it?

- **Precision**: Targets specific lines even in repetitive files (e.g., multiple
  identical `return;` statements).
- **Robustness**: Resistant to "drift" (line numbers shifting due to other
  edits) because the hash verifies the content.
- **Efficiency**: Reduces token usage by eliminating the need for large context
  blocks in the `replace` tool.

### Enabling the Feature

To enable the Hashline protocol, add the following to your `settings.json`
(accessible via `gemini config`):

```json
{
  "experimental": {
    "enableHashline": true
  }
}
```

### Usage

Once enabled, the tools will automatically expose new parameters:

1.  **Read with Hashes**: Use the `read_file` tool with `include_hashes: true`.

    ```bash
    read_file(file_path="src/app.ts", include_hashes=true)
    ```

    **Output:**

    ```text
    1#AB3:import { config } from './config';
    2#WS9:
    3#X7Z:export function run() {
    ```

2.  **Edit with Hashes**: Use the `replace` tool with the `edits` parameter
    (recommended) or the legacy `line_edits` parameter.

    The `edits` parameter supports advanced operations:
    - **`replace`**: Replace a single line or a range of lines.
    - **`append`**: Insert lines after a specific anchor.
    - **`prepend`**: Insert lines before a specific anchor.

    ```bash
    replace(
      file_path="src/app.ts",
      edits=[
        {
          "op": "replace",
          "pos": "3#X7Z",
          "lines": ["export async function run() {"]
        }
      ]
    )
    ```

    **Range Replace:**

    ```bash
    replace(
      file_path="src/app.ts",
      edits=[
        {
          "op": "replace",
          "pos": "3#X7Z",
          "end": "5#DEF",
          "lines": ["export async function run() {", "  await init();", "}"]
        }
      ]
    )
    ```

### Error Handling & Self-Healing

If the content of the line does not match the hash provided (e.g., if the file
was modified externally), the tool will fail fast with a `HASH_MISMATCH` error
to prevent corruption.

When a mismatch occurs, the tool provides a **Recovery Snippet** showing the
current state of the file with the correct Hashline identifiers:

```text
HASHLINE MISMATCH DETECTED
The content of the file has changed. Use the actual Hashline identifiers below to recover:

    3#X7Z: export function run() {
>>> 4#GHI:   // New line added externally
    5#DEF: }
```

The model can then use these updated identifiers to immediately correct its tool
call without requiring an additional `read_file` turn.
