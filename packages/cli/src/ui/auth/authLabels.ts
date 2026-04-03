/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@google/gemini-cli-core';

export const AUTH_LABELS: Record<string, string> = {
  [AuthType.LOGIN_WITH_GOOGLE]: 'Google Account',
  [AuthType.USE_GEMINI]: 'Gemini API Key',
  [AuthType.USE_VERTEX_AI]: 'Vertex AI',
  [AuthType.COMPUTE_ADC]: 'Compute ADC',
  [AuthType.GATEWAY]: 'Gateway',
};
