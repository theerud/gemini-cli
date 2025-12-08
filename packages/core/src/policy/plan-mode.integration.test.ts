/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  ApprovalMode,
  createPolicyEngineConfig,
  PolicyDecision,
} from './config.js';
import { PolicyEngine } from './policy-engine.js';

describe('Plan Mode Policy Integration', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'policy-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    process.chdir(originalCwd);
  });

  it('should deny write tools in PLAN_MODE', async () => {
    // Load policies with PLAN_MODE
    // We point to the actual source policies directory relative to this test file
    // Assuming this test file is in packages/core/src/policy/
    const defaultPoliciesDir = path.resolve(__dirname, 'policies');

    const config = await createPolicyEngineConfig(
      { tools: {}, mcp: {} },
      ApprovalMode.PLAN_MODE,
      defaultPoliciesDir,
    );

    const engine = new PolicyEngine(config);

    // Test Write File
    const writeResult = await engine.check({ name: 'write_file', args: {} });
    expect(writeResult.decision).toBe(PolicyDecision.DENY);

    // Test Replace
    const replaceResult = await engine.check({ name: 'replace', args: {} });
    expect(replaceResult.decision).toBe(PolicyDecision.DENY);

    // Test Shell
    const shellResult = await engine.check({
      name: 'run_shell_command',
      args: {},
    });
    expect(shellResult.decision).toBe(PolicyDecision.DENY);
  });

  it('should allow exit_plan_mode in PLAN_MODE', async () => {
    const defaultPoliciesDir = path.resolve(__dirname, 'policies');

    const config = await createPolicyEngineConfig(
      { tools: {}, mcp: {} },
      ApprovalMode.PLAN_MODE,
      defaultPoliciesDir,
    );

    const engine = new PolicyEngine(config);

    const result = await engine.check({ name: 'exit_plan_mode', args: {} });
    expect(result.decision).toBe(PolicyDecision.ALLOW);
  });

  it('should allow read-only tools in PLAN_MODE', async () => {
    const defaultPoliciesDir = path.resolve(__dirname, 'policies');

    const config = await createPolicyEngineConfig(
      { tools: {}, mcp: {} },
      ApprovalMode.PLAN_MODE,
      defaultPoliciesDir,
    );

    const engine = new PolicyEngine(config);

    const result = await engine.check({ name: 'read_file', args: {} });
    // Should be ALLOW based on read-only.toml which applies generally (no mode restriction usually means all modes)
    // Actually read-only.toml doesn't have a mode set, so it applies to all modes.
    expect(result.decision).toBe(PolicyDecision.ALLOW);
  });

  it('should allow web_fetch in PLAN_MODE', async () => {
    const defaultPoliciesDir = path.resolve(__dirname, 'policies');

    const config = await createPolicyEngineConfig(
      { tools: {}, mcp: {} },
      ApprovalMode.PLAN_MODE,
      defaultPoliciesDir,
    );

    const engine = new PolicyEngine(config);

    const result = await engine.check({ name: 'web_fetch', args: {} });
    // plan-mode.toml explicitly allows web_fetch
    expect(result.decision).toBe(PolicyDecision.ALLOW);
  });

  it('should revert to standard behavior in DEFAULT mode', async () => {
    const defaultPoliciesDir = path.resolve(__dirname, 'policies');

    const config = await createPolicyEngineConfig(
      { tools: {}, mcp: {} },
      ApprovalMode.DEFAULT,
      defaultPoliciesDir,
    );

    const engine = new PolicyEngine(config);

    // Write file should be ASK_USER in default mode
    const writeResult = await engine.check({ name: 'write_file', args: {} });
    expect(writeResult.decision).toBe(PolicyDecision.ASK_USER);

    // Exit Plan Mode tool isn't explicitly denied in default, but it's useless.
    // However, we just want to ensure write tools are NOT denied.
  });
});
