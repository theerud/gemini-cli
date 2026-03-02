/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, describe, it, beforeAll } from 'vitest';
import { SymbolExtractor } from './symbolExtractor.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('SymbolExtractor', () => {
  let extractor: SymbolExtractor;

  beforeAll(async () => {
    extractor = new SymbolExtractor();
  });

  async function getQuery(lang: string) {
    const queryPath = path.join(
      __dirname,
      'queries',
      `tree-sitter-${lang}-tags.scm`,
    );
    return fs.readFile(queryPath, 'utf8');
  }

  it('should extract classes and methods from TypeScript', async () => {
    const tsQuery = await getQuery('typescript');
    const code = `
      class User {
        private name: string;
        constructor(name: string) {
          this.name = name;
        }
        public getName(): string {
          return this.name;
        }
      }
      function identity<T>(arg: T): T {
        return arg;
      }
    `;

    const result = await extractor.extractSymbols(code, 'typescript', tsQuery);

    expect(result.definitions).toContainEqual(
      expect.objectContaining({
        name: 'User',
        kind: expect.stringContaining('definition.class'),
      }),
    );

    expect(result.definitions).toContainEqual(
      expect.objectContaining({
        name: 'getName',
        kind: expect.stringContaining('definition.method'),
      }),
    );

    expect(result.definitions).toContainEqual(
      expect.objectContaining({
        name: 'identity',
        kind: expect.stringContaining('definition.function'),
      }),
    );
  });

  it('should extract functions and calls from Python', async () => {
    const pyQuery = await getQuery('python');
    const code = `
class Database:
    def connect(self):
        print("Connecting...")

def main():
    db = Database()
    db.connect()
    `;

    const result = await extractor.extractSymbols(code, 'python', pyQuery);

    expect(result.definitions).toContainEqual(
      expect.objectContaining({
        name: 'Database',
        kind: expect.stringContaining('definition.class'),
      }),
    );

    expect(result.definitions).toContainEqual(
      expect.objectContaining({
        name: 'connect',
        kind: expect.stringContaining('definition.function'),
      }),
    );

    expect(result.references).toContainEqual(
      expect.objectContaining({
        name: 'Database',
      }),
    );
  });

  it('should extract functions from Bash', async () => {
    const bashQuery = await getQuery('bash');
    const code = `
      function deploy() {
        echo "Deploying..."
        git push origin main
      }
      
      deploy
    `;

    const result = await extractor.extractSymbols(code, 'bash', bashQuery);

    expect(result.definitions).toContainEqual(
      expect.objectContaining({
        name: 'deploy',
        kind: expect.stringContaining('definition.function'),
      }),
    );

    expect(result.references).toContainEqual(
      expect.objectContaining({
        name: 'deploy',
      }),
    );
  });
});
