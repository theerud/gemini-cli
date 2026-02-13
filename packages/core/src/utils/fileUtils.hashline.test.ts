/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { processSingleFileContent } from '../utils/fileUtils.js';
import { computeLineHash } from '../utils/hashline.js';
import { StandardFileSystemService } from '../services/fileSystemService.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('fileUtils - Hashline Mode', () => {
  const fileSystemService = new StandardFileSystemService();

  it('should include hashline prefixes when useHashline is true', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-cli-test-'));
    const filePath = path.join(tempDir, 'test.txt');
    const content = 'line one\nline two';
    fs.writeFileSync(filePath, content);

    const h1 = computeLineHash('line one');
    const h2 = computeLineHash('line two');

    const result = await processSingleFileContent(
      filePath,
      tempDir,
      fileSystemService,
      undefined,
      undefined,
      true, // useHashline
    );

    expect(result.llmContent).toBe(`1:${h1}|line one\n2:${h2}|line two`);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
