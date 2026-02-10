/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import process from 'node:process';
import { formatBytes, formatBytesCompact } from '../utils/formatters.js';

interface MemoryUsageDisplayProps {
  terse?: boolean;
}

export const MemoryUsageDisplay: React.FC<MemoryUsageDisplayProps> = ({
  terse,
}) => {
  const [memoryUsage, setMemoryUsage] = useState<string>('');
  const [memoryUsageColor, setMemoryUsageColor] = useState<string>(
    theme.text.secondary,
  );

  useEffect(() => {
    const updateMemory = () => {
      const usage = process.memoryUsage().rss;
      setMemoryUsage(terse ? formatBytesCompact(usage) : formatBytes(usage));
      setMemoryUsageColor(
        usage >= 2 * 1024 * 1024 * 1024
          ? theme.status.error
          : theme.text.secondary,
      );
    };
    const intervalId = setInterval(updateMemory, 2000);
    updateMemory(); // Initial update
    return () => clearInterval(intervalId);
  }, [terse]);

  return (
    <Box>
      <Text color={theme.text.secondary}>{terse ? ' ' : ' | '}</Text>
      <Text color={memoryUsageColor}>{memoryUsage}</Text>
    </Box>
  );
};
