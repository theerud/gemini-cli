/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import {
  SettingScope,
  type LoadableSettingScope,
  type LoadedSettings,
} from '../../config/settings.js';
import { AuthType, type Config } from '@google/gemini-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { AuthState } from '../types.js';
import { validateAuthMethodWithSettings } from './useAuth.js';
import { relaunchApp } from '../../utils/processUtils.js';

import { AUTH_LABELS } from './authLabels.js';

interface AuthDialogProps {
  config: Config;
  settings: LoadedSettings;
  setAuthState: (state: AuthState) => void;
  authError: string | null;
  onAuthError: (error: string | null) => void;
  setAuthContext: (context: { requiresRestart?: boolean }) => void;
  isAuthPersistent: boolean;
  setIsAuthPersistent: (value: boolean) => void;
}

export function AuthDialog({
  config,
  settings,
  setAuthState,
  authError,
  onAuthError,
  setAuthContext,
  isAuthPersistent,
  setIsAuthPersistent,
}: AuthDialogProps): React.JSX.Element {
  const [exiting, setExiting] = useState(false);
  let items = [
    {
      label: AUTH_LABELS[AuthType.LOGIN_WITH_GOOGLE],
      value: AuthType.LOGIN_WITH_GOOGLE,
      key: AuthType.LOGIN_WITH_GOOGLE,
    },
    ...(process.env['CLOUD_SHELL'] === 'true'
      ? [
          {
            label: 'Use Cloud Shell user credentials',
            value: AuthType.COMPUTE_ADC,
            key: AuthType.COMPUTE_ADC,
          },
        ]
      : process.env['GEMINI_CLI_USE_COMPUTE_ADC'] === 'true'
        ? [
            {
              label: 'Use metadata server application default credentials',
              value: AuthType.COMPUTE_ADC,
              key: AuthType.COMPUTE_ADC,
            },
          ]
        : []),
    {
      label: AUTH_LABELS[AuthType.USE_GEMINI],
      value: AuthType.USE_GEMINI,
      key: AuthType.USE_GEMINI,
    },
    {
      label: AUTH_LABELS[AuthType.USE_VERTEX_AI],
      value: AuthType.USE_VERTEX_AI,
      key: AuthType.USE_VERTEX_AI,
    },
  ];

  if (settings.merged.security.auth.enforcedType) {
    items = items.filter(
      (item) => item.value === settings.merged.security.auth.enforcedType,
    );
  }

  let defaultAuthType = null;
  const defaultAuthTypeEnv = process.env['GEMINI_DEFAULT_AUTH_TYPE'];
  if (
    defaultAuthTypeEnv &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    Object.values(AuthType).includes(defaultAuthTypeEnv as AuthType)
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    defaultAuthType = defaultAuthTypeEnv as AuthType;
  }

  let initialAuthIndex = items.findIndex((item) => {
    if (settings.merged.security.auth.selectedType) {
      return item.value === settings.merged.security.auth.selectedType;
    }

    if (defaultAuthType) {
      return item.value === defaultAuthType;
    }

    if (process.env['GEMINI_API_KEY']) {
      return item.value === AuthType.USE_GEMINI;
    }

    return item.value === AuthType.LOGIN_WITH_GOOGLE;
  });
  if (settings.merged.security.auth.enforcedType) {
    initialAuthIndex = 0;
  }

  const onSelect = useCallback(
    async (
      authType: AuthType | undefined,
      scope: LoadableSettingScope,
      persist: boolean,
    ) => {
      if (exiting) {
        return;
      }
      if (authType) {
        if (authType === AuthType.LOGIN_WITH_GOOGLE) {
          setAuthContext({ requiresRestart: true });
        } else {
          setAuthContext({});
        }

        if (persist) {
          settings.setValue(scope, 'security.auth.selectedType', authType);
        }

        if (
          authType === AuthType.LOGIN_WITH_GOOGLE &&
          config.isBrowserLaunchSuppressed()
        ) {
          setExiting(true);
          setTimeout(relaunchApp, 100);
          return;
        }

        if (authType === AuthType.USE_GEMINI) {
          // Always show the API key input dialog so the user can
          // explicitly enter or confirm their key, regardless of
          // whether GEMINI_API_KEY env var or a stored key exists.
          setAuthState(AuthState.AwaitingApiKeyInput);
          return;
        }

        // For other auth types, refresh immediately if persist is false (otherwise useAuth handles it)
        if (!persist) {
          await config.refreshAuth(authType);
        }
      }
      if (authType) {
        if (persist) {
          setAuthState(AuthState.Unauthenticated);
        } else {
          setAuthState(AuthState.Authenticated);
        }
      } else {
        setAuthState(AuthState.Unauthenticated);
      }
    },
    [settings, config, setAuthState, exiting, setAuthContext],
  );

  const handleAuthSelect = (authMethod: AuthType) => {
    const error = validateAuthMethodWithSettings(authMethod, settings);
    if (error) {
      onAuthError(error);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      onSelect(authMethod, SettingScope.User, isAuthPersistent);
    }
  };

  useKeypress(
    (key) => {
      if (key.sequence === 'p') {
        setIsAuthPersistent(!isAuthPersistent);
        return true;
      }
      if (key.name === 'escape') {
        // Prevent exit if there is an error message.
        // This means they user is not authenticated yet.
        if (authError) {
          return true;
        }
        if (settings.merged.security.auth.selectedType === undefined) {
          // Prevent exiting if no auth method is set
          onAuthError(
            'You must select an auth method to proceed. Press Ctrl+C twice to exit.',
          );
          return true;
        }
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        onSelect(undefined, SettingScope.User, isAuthPersistent);
        return true;
      }
      return false;
    },
    { isActive: true },
  );

  if (exiting) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.ui.focus}
        flexDirection="row"
        padding={1}
        width="100%"
        alignItems="flex-start"
      >
        <Text color={theme.text.primary}>
          Logging in with Google... Restarting Gemini CLI to continue.
        </Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.ui.focus}
      flexDirection="row"
      padding={1}
      width="100%"
      alignItems="flex-start"
    >
      <Text color={theme.text.accent}>? </Text>
      <Box flexDirection="column" flexGrow={1}>
        <Text bold color={theme.text.primary}>
          Get started
        </Text>
        <Box marginTop={1}>
          <Text color={theme.text.primary}>
            How would you like to authenticate for this project?
          </Text>
        </Box>
        <Box marginTop={1}>
          <RadioButtonSelect
            items={items}
            initialIndex={initialAuthIndex}
            onSelect={handleAuthSelect}
            onHighlight={() => {
              onAuthError(null);
            }}
          />
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.primary}>
            {isAuthPersistent ? '⦿' : '○'} Save as default (Press &apos;p&apos;
            to toggle)
          </Text>
        </Box>
        {authError && (
          <Box marginTop={1}>
            <Text color={theme.status.error}>{authError}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>(Use Enter to select)</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.primary}>
            Terms of Services and Privacy Notice for Gemini CLI
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.link}>
            {'https://geminicli.com/docs/resources/tos-privacy/'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
