'use client';

import { Text } from '@formami/react-zen';
import { CURRENT_VERSION } from '@/lib/constants';

export function VersionSetting() {
  return <Text>{CURRENT_VERSION}</Text>;
}
