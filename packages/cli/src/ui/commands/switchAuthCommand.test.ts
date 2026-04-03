/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { switchAuthCommand } from './switchAuthCommand.js';
import { AuthType } from '@google/gemini-cli-core';
import { MessageType } from '../types.js';
import { type CommandContext } from './types.js';
vi.mock('@google/gemini-cli-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@google/gemini-cli-core')>();
  return {
    ...actual,
    UserAccountManager: vi.fn().mockImplementation(() => ({
      getCachedGoogleAccount: vi.fn().mockReturnValue('test@example.com'),
    })),
    loadApiKey: vi.fn().mockResolvedValue('test-key'),
  };
});

describe('switchAuthCommand', () => {
  let mockContext: CommandContext;

  beforeEach(() => {
    mockContext = {
      services: {
        agentContext: {
          config: {
            refreshAuth: vi.fn().mockResolvedValue(undefined),
          },
        },
        settings: {
          setValue: vi.fn(),
        },
      },
      ui: {
        addItem: vi.fn(),
        removeComponent: vi.fn(),
        openAuthDialog: vi.fn(),
      },
    } as unknown as CommandContext;
    vi.clearAllMocks();
  });

  it('switches auth successfully without persist', async () => {
    const result = await switchAuthCommand.action!(
      mockContext,
      AuthType.LOGIN_WITH_GOOGLE,
    );
    expect(result).toBeUndefined();
    expect(
      mockContext.services.agentContext.config.refreshAuth,
    ).toHaveBeenCalledWith(AuthType.LOGIN_WITH_GOOGLE);
    expect(mockContext.services.settings.setValue).not.toHaveBeenCalled();
    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.INFO,
        text: expect.stringContaining('(session only)'),
      }),
    );
  });

  it('switches auth successfully with persist', async () => {
    const result = await switchAuthCommand.action!(
      mockContext,
      `${AuthType.LOGIN_WITH_GOOGLE} --persist`,
    );
    expect(result).toBeUndefined();
    expect(
      mockContext.services.agentContext.config.refreshAuth,
    ).toHaveBeenCalledWith(AuthType.LOGIN_WITH_GOOGLE);
    expect(mockContext.services.settings.setValue).toHaveBeenCalledWith(
      SettingScope.User,
      'security.auth.selectedType',
      AuthType.LOGIN_WITH_GOOGLE,
    );
    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.INFO,
        text: expect.stringContaining('(persisted)'),
      }),
    );
  });

  it('handles unknown auth type', async () => {
    const result = await switchAuthCommand.action!(mockContext, 'unknown-type');
    expect(result).toBeUndefined();
    expect(
      mockContext.services.agentContext.config.refreshAuth,
    ).not.toHaveBeenCalled();
    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.ERROR,
        text: expect.stringContaining('Unknown auth type: unknown-type'),
      }),
    );
  });

  it('handles missing credentials by returning dialog', async () => {
    // Override mock to return null for google account
    vi.mocked(
      (await import('@google/gemini-cli-core')).UserAccountManager,
    ).mockImplementationOnce(
      () =>
        ({
          getCachedGoogleAccount: vi.fn().mockReturnValue(null),
        }) as unknown as typeof import('@google/gemini-cli-core').UserAccountManager,
    );

    const result = await switchAuthCommand.action!(
      mockContext,
      AuthType.LOGIN_WITH_GOOGLE,
    );
    expect(result).toEqual({
      type: 'dialog',
      dialog: 'auth',
    });
    expect(
      mockContext.services.agentContext.config.refreshAuth,
    ).not.toHaveBeenCalled();
    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.WARNING,
      }),
    );
  });

  it('handles refreshAuth error', async () => {
    mockContext.services.agentContext.config.refreshAuth.mockRejectedValueOnce(
      new Error('Network error'),
    );
    const result = await switchAuthCommand.action!(
      mockContext,
      AuthType.LOGIN_WITH_GOOGLE,
    );
    expect(result).toBeUndefined();
    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.ERROR,
        text: expect.stringContaining('Failed to switch to'),
      }),
    );
  });
});
