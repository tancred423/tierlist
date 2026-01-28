import { create } from 'zustand';

export type ClockFormat = '12h' | '24h' | 'system';

interface ClockFormatState {
  format: ClockFormat;
  setFormat: (format: ClockFormat) => void;
  getEffectiveFormat: () => '12h' | '24h';
}

function getSystemClockFormat(): '12h' | '24h' {
  const testDate = new Date(2000, 0, 1, 13, 0, 0);
  const formatted = testDate.toLocaleTimeString(navigator.language);
  return formatted.includes('PM') || formatted.includes('AM') ? '12h' : '24h';
}

export const useClockFormatStore = create<ClockFormatState>((set, get) => {
  const storedFormat = localStorage.getItem('clockFormat') as ClockFormat | null;
  const initialFormat: ClockFormat = storedFormat || 'system';

  return {
    format: initialFormat,
    setFormat: (format: ClockFormat) => {
      localStorage.setItem('clockFormat', format);
      set({ format });
    },
    getEffectiveFormat: () => {
      const { format } = get();
      if (format === 'system') {
        return getSystemClockFormat();
      }
      return format;
    },
  };
});
