/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { ApprovalMode } from '@google/gemini-cli-core';
import { useTerminalSize } from '../hooks/useTerminalSize.js';

interface ApprovalModeIndicatorProps {
  approvalMode: ApprovalMode;
  isPlanEnabled?: boolean;
}

export const ApprovalModeIndicator: React.FC<ApprovalModeIndicatorProps> = ({
  approvalMode,
  isPlanEnabled,
}) => {
  const { columns: terminalWidth } = useTerminalSize();
  const isCompact = terminalWidth < 100;

  let textColor = '';
  let textContent = '';
  let subText = '';

  const cycleText = isCompact ? '[⇧]+[⇥]' : 'shift + tab';
  const enterText = isCompact ? 'for' : 'to enter';
  const modeSuffix = isCompact ? '' : ' mode';

  switch (approvalMode) {
    case ApprovalMode.AUTO_EDIT:
      textColor = theme.status.warning;
      textContent = 'auto-edit';
      subText = `${cycleText} ${enterText} default${modeSuffix}`;
      break;
    case ApprovalMode.PLAN:
      textColor = theme.status.success;
      textContent = 'plan';
      subText = `${cycleText} ${enterText} auto-edit${modeSuffix}`;
      break;
    case ApprovalMode.YOLO:
      textColor = theme.status.error;
      textContent = 'YOLO';
      subText = `${cycleText} ${enterText} auto-edit${modeSuffix}`;
      break;
    case ApprovalMode.DEFAULT:
    default:
      textColor = theme.text.accent;
      textContent = '';
      subText = isPlanEnabled
        ? `${cycleText} ${enterText} plan${modeSuffix}`
        : `${cycleText} ${enterText} auto-edit${modeSuffix}`;
      break;
  }

  return (
    <Box>
      <Text color={textColor}>
        {textContent ? textContent : null}
        {subText ? (
          <Text color={theme.text.secondary}>
            {textContent ? ' ' : ''}
            {subText}
          </Text>
        ) : null}
      </Text>
    </Box>
  );
};
