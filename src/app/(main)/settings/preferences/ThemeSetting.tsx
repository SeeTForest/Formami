import { useTheme } from '@formami/react-zen';
import { ThemeModeSelector } from '@/components/input/ThemeModeSelector';

export function ThemeSetting() {
  const { theme, setTheme } = useTheme();

  return (
    <ThemeModeSelector value={theme} onChange={value => setTheme(value as 'light' | 'dark')} />
  );
}
