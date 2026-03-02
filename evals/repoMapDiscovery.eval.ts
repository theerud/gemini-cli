/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe } from 'vitest';
import { evalTest } from './test-helper.js';

describe('RepoMap Discovery Eval', () => {
  /**
   * Verifies that the CodebaseInvestigator agent uses structural tools
   * when asked about codebase architecture.
   */
  evalTest('USUALLY_PASSES', {
    name: 'CodebaseInvestigator should use get_repo_map for architectural overview',
    params: {
      settings: {
        experimental: {
          codeIntelligence: { repoMap: { enabled: true } },
        },
      },
    },
    prompt:
      '@codebase_investigator "Explain the project structure and key components."',
    files: {
      'src/main.ts':
        'import { Service } from "./service"; const s = new Service(); s.run();',
      'src/service.ts':
        'export class Service { run() { console.log("running"); } }',
      'package.json': '{ "name": "test-project" }',
    },
    assert: async (rig, _result) => {
      await rig.expectToolCallSuccess(['get_repo_map']);
    },
  });

  /**
   * Verifies that the agent drills down into symbols.
   */
  evalTest('USUALLY_PASSES', {
    name: 'CodebaseInvestigator should use list_symbols to drill down',
    params: {
      settings: {
        experimental: {
          codeIntelligence: { repoMap: { enabled: true } },
        },
      },
    },
    prompt:
      '@codebase_investigator "List the methods in Service class in src/service.ts"',
    files: {
      'src/main.ts': 'import { Service } from "./service";',
      'src/service.ts': 'export class Service { run() {} stop() {} }',
    },
    assert: async (rig, _result) => {
      await rig.expectToolCallSuccess(['list_symbols']);
    },
  });
});
