/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import {
  AuthType,
  UserAccountManager,
  loadApiKey,
  type Config,
} from '@google/gemini-cli-core';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { SettingScope, type LoadedSettings } from '../../config/settings.js';

import { AUTH_LABELS } from './authLabels.js';

export function SwitchAuthDialog({
  config,
  settings,
  onClose,
  openAuthSetup,
}: {
  config: Config;
  settings: LoadedSettings;
  onClose: () => void;
  openAuthSetup: () => void;
}) {
  const [readyStates, setReadyStates] = useState<
    Record<string, string | boolean>
  >({});
  const [persist, setPersist] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkReady() {
      const states: Record<string, string | boolean> = {};
      // Google
      const userAccountManager = new UserAccountManager();
      const email = userAccountManager.getCachedGoogleAccount();
      states[AuthType.LOGIN_WITH_GOOGLE] = email ? email : false;

      // Gemini
      const key = await loadApiKey();
      states[AuthType.USE_GEMINI] = !!key || !!process.env['GEMINI_API_KEY'];

      // Vertex
      states[AuthType.USE_VERTEX_AI] =
        !!process.env['GOOGLE_CLOUD_PROJECT'] ||
        !!process.env['GCP_PROJECT'] ||
        !!process.env['GOOGLE_APPLICATION_CREDENTIALS'];

      // ADC
      states[AuthType.COMPUTE_ADC] =
        process.env['CLOUD_SHELL'] === 'true' ||
        process.env['GEMINI_CLI_USE_COMPUTE_ADC'] === 'true';

      setReadyStates(states);
      setLoading(false);
    }
    void checkReady();
  }, []);

  useKeypress(
    (key) => {
      if (key.sequence === 'p') {
        setPersist(!persist);
        return true;
      }
      if (key.name === 'escape') {
        onClose();
        return true;
      }
      return false;
    },
    { isActive: true },
  );

  if (loading) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.ui.focus}
        padding={1}
        width="100%"
      >
        <Text>Checking authentication status...</Text>
      </Box>
    );
  }

  const currentAuth = config.getContentGeneratorConfig()?.authType;

  let items = Object.values(AuthType).map((type) => {
    const isReady = readyStates[type];
    let label = AUTH_LABELS[type] || type;
    if (isReady) {
      label += typeof isReady === 'string' ? ` (${isReady})` : ' (Ready)';
    } else {
      label += ' (Not configured)';
    }
    return {
      label,
      value: type,
      key: type,
    };
  });

  if (settings.merged.security.auth.enforcedType) {
    items = items.filter(
      (item) => item.value === settings.merged.security.auth.enforcedType,
    );
  }

  const initialIndex = Math.max(
    0,
    items.findIndex((i) => i.value === currentAuth),
  );

  const handleSelect = async (authType: AuthType) => {
    if (!readyStates[authType]) {
      onClose();
      openAuthSetup();
      return;
    }

    try {
      await config.refreshAuth(authType);
      if (persist) {
        settings.setValue(
          SettingScope.User,
          'security.auth.selectedType',
          authType,
        );
      }
    } catch {
      // CLI UI handlers catch downstream usually
    } finally {
      onClose();
    }
  };

  return (
    <Box
      borderStyle="round"
      borderColor={theme.ui.focus}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={theme.text.primary}>
        Switch Authentication
      </Text>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={initialIndex}
          onSelect={handleSelect}
        />
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text.primary}>
          {persist ? '⦿' : '○'} Persist this choice across sessions (Press
          &apos;p&apos; to toggle)
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          (Use Enter to select, Esc to cancel)
        </Text>
      </Box>
    </Box>
  );
}
