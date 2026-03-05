/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useEffect, useState } from 'react';
import { Text, Box } from 'ink';
import { theme } from '../semantic-colors.js';
import process from 'node:process';
import { formatBytes, formatBytesCompact } from '../utils/formatters.js';

interface MemoryUsageDisplayProps {
  color?: string;
  terse?: boolean;
}

export const MemoryUsageDisplay: React.FC<MemoryUsageDisplayProps> = ({
  color = theme.text.primary,
  terse,
}) => {
  const [memoryUsage, setMemoryUsage] = useState<string>('');
  const [memoryUsageColor, setMemoryUsageColor] = useState<string>(color);

  useEffect(() => {
    const updateMemory = () => {
      const usage = process.memoryUsage().rss;
      setMemoryUsage(terse ? formatBytesCompact(usage) : formatBytes(usage));
      setMemoryUsageColor(
        usage >= 2 * 1024 * 1024 * 1024 ? theme.status.error : color,
      );
    };
    const intervalId = setInterval(updateMemory, 2000);
    updateMemory(); // Initial update
    return () => clearInterval(intervalId);
  }, [color, terse]);

  return (
    <Box>
      <Text color={memoryUsageColor}>{memoryUsage}</Text>
    </Box>
  );
};
