'use client';
import { DialogTrigger } from '@formami/react-zen';
import type { ReactElement } from 'react';

export function ControlledDialog({ children }: { children: ReactElement }) {
  return (
    <DialogTrigger>
      <button type="button" hidden />
      {children}
    </DialogTrigger>
  );
}
