/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { renderWithProviders } from '../../test-utils/render.js';
import { waitFor } from '../../test-utils/async.js';
import { SwitchAuthDialog } from './SwitchAuthDialog.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthType, type Config } from '@google/gemini-cli-core';
import { type LoadedSettings } from '../../config/settings.js';
import { SettingScope } from '../../config/settings.js';

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

describe('SwitchAuthDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and shows available auth options', async () => {
    const config = {
      getContentGeneratorConfig: vi
        .fn()
        .mockReturnValue({ authType: AuthType.LOGIN_WITH_GOOGLE }),
      refreshAuth: vi.fn(),
    } as unknown as Config;
    const settings = {
      merged: { security: { auth: {} } },
      setValue: vi.fn(),
    } as unknown as LoadedSettings;
    const onClose = vi.fn();
    const openAuthSetup = vi.fn();

    const renderResult = await renderWithProviders(
      <SwitchAuthDialog
        config={config}
        settings={settings}
        onClose={onClose}
        openAuthSetup={openAuthSetup}
      />,
    );
    await renderResult.waitUntilReady();
    await waitFor(() => {
      expect(renderResult.lastFrame()).toContain('Google Account');
    });

    // Test toggle persist
    const { stdin } = renderResult;
    stdin.write('p');
    await waitFor(() => {
      expect(renderResult.lastFrame()).toContain('⦿ Persist this choice');
    });

    // Test select
    stdin.write('\r');
    await waitFor(() => {
      expect(config.refreshAuth).toHaveBeenCalledWith(
        AuthType.LOGIN_WITH_GOOGLE,
      );
      expect(settings.setValue).toHaveBeenCalledWith(
        SettingScope.User,
        'security.auth.selectedType',
        AuthType.LOGIN_WITH_GOOGLE,
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
