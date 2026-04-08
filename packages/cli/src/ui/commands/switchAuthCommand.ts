/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  UserAccountManager,
  loadApiKey,
} from '@google/gemini-cli-core';
import {
  type CommandContext,
  CommandKind,
  type SlashCommand,
} from './types.js';
import { SettingScope } from '../../config/settings.js';
import React from 'react';
import { SwitchAuthDialog } from '../auth/SwitchAuthDialog.js';
import { MessageType } from '../types.js';

import { AUTH_LABELS } from '../auth/authLabels.js';

async function isAuthReady(type: AuthType): Promise<boolean> {
  switch (type) {
    case AuthType.LOGIN_WITH_GOOGLE: {
      const userAccountManager = new UserAccountManager();
      return !!userAccountManager.getCachedGoogleAccount();
    }
    case AuthType.USE_GEMINI: {
      const key = await loadApiKey();
      return !!key || !!process.env['GEMINI_API_KEY'];
    }
    case AuthType.USE_VERTEX_AI:
      return (
        !!process.env['GOOGLE_CLOUD_PROJECT'] ||
        !!process.env['GCP_PROJECT'] ||
        !!process.env['GOOGLE_APPLICATION_CREDENTIALS']
      );
    case AuthType.COMPUTE_ADC:
      return (
        process.env['CLOUD_SHELL'] === 'true' ||
        process.env['GEMINI_CLI_USE_COMPUTE_ADC'] === 'true'
      );
    default:
      return false;
  }
}

export const switchAuthCommand: SlashCommand = {
  name: 'switch-auth',
  description: 'Quickly switch authentication method for the current session',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  action: async (context: CommandContext, args: string) => {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    const persist = parts.includes('--persist');
    const typeArg = parts.find((p) => !p.startsWith('--'));

    if (typeArg) {
      // Direct switch
      const authType = Object.values(AuthType).find((v) => v === typeArg);
      if (!authType) {
        context.ui.addItem({
          type: MessageType.ERROR,
          text: `Unknown auth type: ${typeArg}. Available: ${Object.values(
            AuthType,
          ).join(', ')}`,
        });
        return;
      }

      if (await isAuthReady(authType as AuthType)) {
        try {
          if (context.services.agentContext?.config) {
            await context.services.agentContext.config.refreshAuth(
              authType as AuthType,
            );
            if (persist) {
              context.services.settings.setValue(
                SettingScope.User,
                'security.auth.selectedType',
                authType,
              );
            }
            context.ui.addItem({
              type: MessageType.INFO,
              text: `Switched to ${AUTH_LABELS[authType] || authType}${persist ? ' (persisted)' : ' (session only)'}`,
            });
          }
        } catch (error) {
          context.ui.addItem({
            type: MessageType.ERROR,
            text: `Failed to switch to ${AUTH_LABELS[authType] || authType}: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
        return;
      } else {
        context.ui.addItem({
          type: MessageType.WARNING,
          text: `${AUTH_LABELS[authType] || authType} is not configured. Opening setup dialog...`,
        });
        context.ui.setIsAuthPersistent(persist);
        return {
          type: 'dialog',
          dialog: 'auth',
        };
      }
    }

    if (!context.services.agentContext?.config) {
      return;
    }

    return {
      type: 'custom_dialog',
      component: React.createElement(SwitchAuthDialog, {
        config: context.services.agentContext.config,
        settings: context.services.settings,
        onClose: () => context.ui.removeComponent(),
        openAuthSetup: () => context.ui.openAuthDialog(),
      }),
    };
  },
};
