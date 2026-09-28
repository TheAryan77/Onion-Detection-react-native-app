import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import type { LotVerdict } from '@/types';

// Two palettes with the same tokens. "light" is white paper with leaf-green accents;
// "green" swaps them: deep green surfaces with white accents. Status colours are lifted in green
// mode so they stay readable on the dark background.
const light = {
  brand: '#166534', onBrand: '#FFFFFF', brandSoft: '#E7F4EC', onBrandSoft: '#166534',
  bg: '#F4F7F5', card: '#FFFFFF', input: '#F4F7F5',
  ink: '#10231A', muted: '#5E6E66', faint: '#94A39B', border: '#E2EAE5',
  gradeA: '#15803D', urs: '#B45309', reject: '#B91C1C',
  tintA: '#E8F5EC', tintUrs: '#FDF3E4', tintReject: '#FCEBEA', tintNone: '#EEF1EF',
  warnBg: '#FFF6E6', warnBorder: '#F3D9A8', warnText: '#7A4B00',
  heroFrom: '#0B3B22', heroTo: '#166534', heroText: '#FFFFFF', heroSub: 'rgba(255,255,255,0.8)', heroEyebrow: '#A7E3BD',
  heroBtnBg: '#FFFFFF', heroBtnText: '#0B3B22',
  heroGhostBg: 'rgba(255,255,255,0.14)', heroGhostBorder: 'rgba(255,255,255,0.25)', heroGhostText: '#FFFFFF',
  heroTrack: 'rgba(255,255,255,0.14)', heroSegText: 'rgba(255,255,255,0.85)',
  shadow: '0px 1px 2px rgba(16, 35, 26, 0.05), 0px 6px 20px rgba(16, 35, 26, 0.06)',
  backdrop: 'rgba(16, 35, 26, 0.35)',
  statusBar: 'dark' as 'dark' | 'light',
};

export type Palette = typeof light;

const green: Palette = {
  brand: '#FFFFFF', onBrand: '#0B3B22', brandSoft: '#1B5C39', onBrandSoft: '#FFFFFF',
  bg: '#0B3B22', card: '#114A2C', input: '#0E4227',
  ink: '#FFFFFF', muted: '#B7D2C2', faint: '#7FA590', border: '#1E5C3B',
  gradeA: '#6EE7A0', urs: '#FCC46B', reject: '#FF9B92',
  tintA: '#6EE7A01F', tintUrs: '#FCC46B1F', tintReject: '#FF9B921F', tintNone: '#FFFFFF14',
  warnBg: '#FCC46B1A', warnBorder: '#FCC46B55', warnText: '#FCD9A0',
  heroFrom: '#FFFFFF', heroTo: '#E3F2E8', heroText: '#0B3B22', heroSub: '#3F5E4D', heroEyebrow: '#1F8A4C',
  heroBtnBg: '#0B3B22', heroBtnText: '#FFFFFF',
  heroGhostBg: '#0B3B2212', heroGhostBorder: '#0B3B2233', heroGhostText: '#0B3B22',
  heroTrack: '#0B3B2214', heroSegText: '#3F5E4D',
  shadow: '0px 6px 20px rgba(0, 0, 0, 0.18)',
  backdrop: 'rgba(0, 0, 0, 0.45)',
  statusBar: 'light',
};

export type ThemeMode = 'light' | 'green';
const PALETTES: Record<ThemeMode, Palette> = { light, green };
const KEY = 'theme:v1';

type ThemeValue = {
  mode: ThemeMode;
  colors: Palette;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
  categoryColor: Record<LotVerdict, string>;
  categoryTint: Record<LotVerdict, string>;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === 'green' || v === 'light') setModeState(v); }).catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const c = PALETTES[mode];
    return {
      mode,
      colors: c,
      setMode,
      toggle: () => setMode(mode === 'light' ? 'green' : 'light'),
      categoryColor: { GRADE_A: c.gradeA, URS: c.urs, REJECT: c.reject, NO_ONIONS: c.muted },
      categoryTint: { GRADE_A: c.tintA, URS: c.tintUrs, REJECT: c.tintReject, NO_ONIONS: c.tintNone },
    };
  }, [mode, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme must be used inside ThemeProvider');
  return v;
}

/** Declare styles once per file; the returned hook gives the sheet for the active palette. */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(fn: (c: Palette) => T): () => T {
  const cache = new Map<Palette, T>();
  return () => {
    const { colors } = useTheme();
    let sheet = cache.get(colors);
    if (!sheet) {
      sheet = StyleSheet.create(fn(colors));
      cache.set(colors, sheet);
    }
    return sheet;
  };
}

// The evidence image and the PDF are drawn with fixed colours, so their legend uses these.
export const printCategoryColor: Record<LotVerdict, string> = {
  GRADE_A: light.gradeA, URS: light.urs, REJECT: light.reject, NO_ONIONS: light.muted,
};

export const radius = { sm: 10, md: 14, lg: 20 };

/** Centres content on wide screens (web) while staying full-width on phones. */
export const pageWidth = { width: '100%', maxWidth: 640, alignSelf: 'center' } as const;

export const categoryIcon: Record<LotVerdict, 'checkmark-circle' | 'alert-circle' | 'close-circle' | 'help-circle'> = {
  GRADE_A: 'checkmark-circle',
  URS: 'alert-circle',
  REJECT: 'close-circle',
  NO_ONIONS: 'help-circle',
};

export const categoryLabel: Record<LotVerdict, string> = {
  GRADE_A: 'Grade A',
  URS: 'URS',
  REJECT: 'Reject',
  NO_ONIONS: 'No onions found',
};

export const defectLabel: Record<string, string> = {
  cuts: 'Cut / damaged',
  rotten: 'Rotten',
  sprout: 'Sprouted',
  undersized: 'Undersized',
  oversized: 'Oversized',
};
