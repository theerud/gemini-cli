/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect } from 'vitest';
import { evalTest } from './test-helper.js';

const STRESS_TEST_FILE = {
  'processor.ts': `
class BaseProcessor {
  id: string = 'base';
  process(data: any) { return data; }
}

class ProcessorA extends BaseProcessor {
  id: string = 'A';
  run() {
    console.log(this.id);
  }
}

class ProcessorB extends BaseProcessor {
  id: string = 'B';
  run() {
    console.log(this.id);
  }
}

class ProcessorC extends BaseProcessor {
  id: string = 'C';
  run() {
    console.log(this.id);
  }
}

class ProcessorD extends BaseProcessor {
  id: string = 'D';
  run() {
    console.log(this.id);
  }
}
  `.trim(),
};

const STRESS_TEST_PROMPT =
  'In processor.ts, rename the "id" property to "alphaId" ONLY in ProcessorA, and to "gammaId" ONLY in ProcessorC. Leave all other classes untouched.';

describe('Hashline Precision Benchmark', () => {
  evalTest('USUALLY_PASSES', {
    name: 'Precision Task - Legacy Mode',
    timeout: 300000,
    params: {
      settings: { experimental: { hashlineEditMode: false } },
    },
    files: STRESS_TEST_FILE,
    prompt: STRESS_TEST_PROMPT,
    assert: async (rig) => {
      const content = rig.readFile('processor.ts');
      expect(content).toContain("alphaId: string = 'A'");
      expect(content).toContain("gammaId: string = 'C'");
      expect(content).toContain("id: string = 'B'");
      expect(content).toContain("id: string = 'D'");

      // Log token usage
      await rig.waitForTelemetryReady();
      const telemetry = (rig as any)._readAndParseTelemetryLog() as any[];
      const apiResponse = telemetry
        .reverse()
        .find(
          (l) => l.attributes?.['event.name'] === 'gemini_cli.api_response',
        );
      if (apiResponse) {
        console.log('Legacy Tokens:', apiResponse.attributes.input_token_count);
      }
    },
  });

  evalTest('USUALLY_PASSES', {
    name: 'Precision Task - Hashline Mode',
    timeout: 300000,
    params: {
      settings: { experimental: { hashlineEditMode: true } },
    },
    files: STRESS_TEST_FILE,
    prompt: STRESS_TEST_PROMPT,
    assert: async (rig) => {
      const content = rig.readFile('processor.ts');
      expect(content).toContain("alphaId: string = 'A'");
      expect(content).toContain("gammaId: string = 'C'");
      expect(content).toContain("id: string = 'B'");
      expect(content).toContain("id: string = 'D'");

      // Log token usage
      await rig.waitForTelemetryReady();
      const telemetry = (rig as any)._readAndParseTelemetryLog() as any[];
      const apiResponse = telemetry
        .reverse()
        .find(
          (l) => l.attributes?.['event.name'] === 'gemini_cli.api_response',
        );
      if (apiResponse) {
        console.log(
          'Hashline Tokens:',
          apiResponse.attributes.input_token_count,
        );
      }

      const toolLogs = rig.readToolLogs();
      const editCalls = toolLogs.filter(
        (t) => t.toolRequest.name === 'replace',
      );
      const hasHashline = editCalls.some((t) => {
        const args =
          typeof t.toolRequest.args === 'string'
            ? JSON.parse(t.toolRequest.args)
            : t.toolRequest.args;
        // Check for "12:a1|" prefix at the start of any line in old_string
        return /^(\d+):([0-9a-z]{2})\|/m.test(args.old_string);
      });
      expect(
        hasHashline,
        'Hashline anchors (LINE:HA|) should be used in edit calls in hashline mode',
      ).toBe(true);
    },
  });
});
