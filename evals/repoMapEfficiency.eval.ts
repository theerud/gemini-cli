/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect } from 'vitest';
import { evalTest } from './test-helper.js';

/**
 * This eval measures the performance gain of RepoMap in a medium-sized project
 * with deep dependency chains and noise files.
 */
describe('RepoMap Efficiency Evaluation', () => {
  const MOCK_CODEBASE = {
    // Layer 1: API
    'src/api/users.ts':
      'import { UserService } from "../services/userService"; export const getUsers = () => UserService.getAll();',
    'src/api/health.ts': 'export const health = () => "ok";',

    // Layer 2: Services
    'src/services/userService.ts':
      'import { Repository } from "../db/repository"; import { logger } from "../utils/logger"; export class UserService { static getAll() { logger.log("fetching"); return Repository.find(); } }',
    'src/services/orderService.ts':
      'export class OrderService { static get() { return []; } }',

    // Layer 3: Repository
    'src/db/repository.ts':
      'import { DBClient } from "./dbClient"; export class Repository { static find() { return DBClient.query("SELECT * FROM users"); } }',
    'src/db/schema.ts': 'export const schema = { users: ["id", "name"] };',

    // Layer 4: Infrastructure (The Target)
    'src/db/dbClient.ts': `
      export class DBClient {
        // CONFIG: Connection pool size is 25
        private static poolSize = 25; 
        static query(q: string) { return []; }
      }
    `,
    'src/db/redis.ts': 'export class Redis { static get() {} }',

    // Layer 5: Utils & Noise
    'src/utils/logger.ts':
      'export const logger = { log: (m: string) => console.log(m) };',
    'src/utils/math.ts': 'export const add = (a: number, b: number) => a + b;',
    'src/utils/string.ts':
      'export const capitalize = (s: string) => s.toUpperCase();',
    'src/utils/dates.ts': 'export const now = () => new Date();',
    'src/utils/auth_legacy.ts': 'export const oldAuth = () => true;',
    'src/utils/helpers.ts': 'export const help = () => {};',
    'src/utils/validators.ts': 'export const validate = () => true;',
    'src/utils/formatter.ts': 'export const format = () => "";',
    'src/utils/parser.ts': 'export const parse = () => ({});',
    'src/utils/constants.ts': 'export const VERSION = "1.0.0";',
    'package.json': '{ "name": "performance-benchmark" }',
  };

  const PROMPT =
    '@codebase_investigator "Find the exact line where the database connection pool size is configured and tell me the value."';

  /**
   * Baseline: Traditional discovery
   */
  evalTest('USUALLY_PASSES', {
    name: 'Traditional Search (Baseline)',
    params: {
      settings: {
        experimental: { codeIntelligence: { repoMap: { enabled: false } } },
      },
    },
    prompt: PROMPT,
    files: MOCK_CODEBASE,
    assert: async (rig, _result) => {
      const apiLogs = rig.readAllApiRequest();
      const toolLogs = rig.readToolLogs();
      console.log(
        `[Metrics] Traditional - Turns: ${apiLogs.length}, ToolCalls: ${toolLogs.length}`,
      );
      // In a deep chain like this, traditional tools often take 3+ turns
      expect(apiLogs.length).toBeGreaterThanOrEqual(2);
    },
  });

  /**
   * Optimized: RepoMap enabled
   */
  evalTest('USUALLY_PASSES', {
    name: 'RepoMap Optimized (Target)',
    params: {
      settings: {
        experimental: { codeIntelligence: { repoMap: { enabled: true } } },
      },
    },
    prompt: PROMPT,
    files: MOCK_CODEBASE,
    assert: async (rig, _result) => {
      const apiLogs = rig.readAllApiRequest();
      const toolLogs = rig.readToolLogs();
      console.log(
        `[Metrics] RepoMap - Turns: ${apiLogs.length}, ToolCalls: ${toolLogs.length}`,
      );

      // Verify RepoMap tools were actually used
      await rig.expectToolCallSuccess(['get_repo_map']);

      // Verification of the answer
      expect(_result).toContain('25');
      expect(_result).toContain('dbClient.ts');
    },
  });
});
