/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect } from 'vitest';
import { evalTest } from './test-helper.js';

// Stress test file with multiple similar blocks and repetitive patterns
const STRESS_FILE_CONTENT = `
/**
 * Highly repetitive file to stress test edit precision.
 */

export class ServiceOne {
  private status: string = 'idle';

  public init() {
    this.status = 'starting';
    console.log('ServiceOne init');
    this.status = 'ready';
  }

  public stop() {
    this.status = 'stopping';
    console.log('ServiceOne stop');
    this.status = 'idle';
  }
}

export class ServiceTwo {
  private status: string = 'idle';

  public init() {
    this.status = 'starting';
    console.log('ServiceTwo init');
    this.status = 'ready';
  }

  public stop() {
    this.status = 'stopping';
    console.log('ServiceTwo stop');
    this.status = 'idle';
  }
}

export class ServiceThree {
  private status: string = 'idle';

  public init() {
    this.status = 'starting';
    console.log('ServiceThree init');
    this.status = 'ready';
  }

  public stop() {
    this.status = 'stopping';
    console.log('ServiceThree stop');
    this.status = 'idle';
  }
}

export class ServiceFour {
  private status: string = 'idle';

  public init() {
    this.status = 'starting';
    console.log('ServiceFour init');
    this.status = 'ready';
  }

  public stop() {
    this.status = 'stopping';
    console.log('ServiceFour stop');
    this.status = 'idle';
  }
}

// Padding to make the file larger
${Array(2000).fill('// ... placeholder content ...').join('\n')}

export class DeepService {
  private status: string = 'idle';
  private config = {
    nested: {
      status: 'idle',
      value: 100
    }
  };

  public update() {
    // This specific line is hard to target in legacy mode if context is too narrow
    this.config.nested.status = 'active';
    this.status = 'active';
  }
}
`.trim();

const PROMPT = `
In services.ts:
1. In ServiceTwo's init method, change 'ready' to 'initialized'.
2. In ServiceFour's stop method, change 'idle' to 'terminated'.
3. In DeepService's update method, change the nested config status from 'active' to 'processed'.
`.trim();

describe('Edit Precision Stress Test', () => {
  const files = { 'services.ts': STRESS_FILE_CONTENT };

  evalTest('USUALLY_PASSES', {
    name: 'Stress Test - Legacy Mode',
    timeout: 300000,
    params: {
      settings: { experimental: { hashlineEditMode: false } },
    },
    files,
    prompt: PROMPT,
    assert: async (rig) => {
      const content = rig.readFile('services.ts');

      // Verify correct edits
      expect(content).toContain(
        "ServiceTwo init');\n    this.status = 'initialized';",
      );
      expect(content).toContain(
        "ServiceFour stop');\n    this.status = 'terminated';",
      );
      expect(content).toContain("this.config.nested.status = 'processed';");

      // Verify no collateral damage
      expect(content).toContain(
        "ServiceOne init');\n    this.status = 'ready';",
      );
      expect(content).toContain(
        "ServiceThree init');\n    this.status = 'ready';",
      );
      expect(content).toContain(
        "ServiceOne stop');\n    this.status = 'idle';",
      );

      await rig.waitForTelemetryReady();
      const telemetry = (rig as any)._readAndParseTelemetryLog() as any[];
      const apiResponse = telemetry
        .reverse()
        .find(
          (l: any) =>
            l.attributes?.['event.name'] === 'gemini_cli.api_response',
        );
      if (apiResponse) {
        console.log(
          'Legacy Stress Tokens:',
          apiResponse.attributes.input_token_count,
        );
      }
    },
  });

  evalTest('USUALLY_PASSES', {
    name: 'Stress Test - Hashline Mode',
    timeout: 300000,
    params: {
      settings: { experimental: { hashlineEditMode: true } },
    },
    files,
    prompt: PROMPT,
    assert: async (rig) => {
      const content = rig.readFile('services.ts');

      // Verify correct edits
      expect(content).toContain(
        "ServiceTwo init');\n    this.status = 'initialized';",
      );
      expect(content).toContain(
        "ServiceFour stop');\n    this.status = 'terminated';",
      );
      expect(content).toContain("this.config.nested.status = 'processed';");

      // Verify no collateral damage
      expect(content).toContain(
        "ServiceOne init');\n    this.status = 'ready';",
      );
      expect(content).toContain(
        "ServiceThree init');\n    this.status = 'ready';",
      );
      expect(content).toContain(
        "ServiceOne stop');\n    this.status = 'idle';",
      );

      await rig.waitForTelemetryReady();
      const telemetry = (rig as any)._readAndParseTelemetryLog() as any[];
      const apiResponse = telemetry
        .reverse()
        .find(
          (l: any) =>
            l.attributes?.['event.name'] === 'gemini_cli.api_response',
        );
      if (apiResponse) {
        console.log(
          'Hashline Stress Tokens:',
          apiResponse.attributes.input_token_count,
        );
      }

      const toolLogs = rig.readToolLogs();
      const editCalls = toolLogs.filter(
        (t) => t.toolRequest.name === 'replace',
      );
      const hasHashline = editCalls.every((t) => {
        const args =
          typeof t.toolRequest.args === 'string'
            ? JSON.parse(t.toolRequest.args)
            : t.toolRequest.args;
        return /^(\d+):([0-9a-z]{2})\|/m.test(args.old_string);
      });
      expect(
        hasHashline,
        'All edit calls in hashline mode should use line anchors',
      ).toBe(true);
    },
  });
});
