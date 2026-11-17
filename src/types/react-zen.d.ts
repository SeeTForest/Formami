import { ReactNode } from 'react';
import '@formami/react-zen';

declare module '@formami/react-zen' {
  interface SelectProps {
    children?: ReactNode;
  }

  interface TooltipProps {
    children?: ReactNode;
  }
}
