import { useColorScheme } from 'react-native';
import { Status } from './storage';

const light = {
  bg: '#FBF6EF',
  card: '#FFFFFF',
  text: '#2B2420',
  muted: '#8A7F76',
  line: '#EDE4D9',
  good: '#3E8E5E',
  warn: '#D98B2B',
  bad: '#C9472F',
  accent: '#3E8E5E',
  accentSoft: '#E3F1E8',
  chip: '#F3ECE3',
  onAccent: '#FFFFFF',
  dark: false,
};

const dark: typeof light = {
  bg: '#171412',
  card: '#221E1B',
  text: '#F4EDE6',
  muted: '#A0958C',
  line: '#332D29',
  good: '#5DBB82',
  warn: '#EBA54D',
  bad: '#E8664D',
  accent: '#5DBB82',
  accentSoft: '#1E3527',
  chip: '#2C2723',
  onAccent: '#10261A',
  dark: true,
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export function statusColor(t: Theme, s: Status): string {
  return s === 'good' ? t.good : s === 'soon' ? t.warn : s === 'overdue' ? t.bad : t.muted;
}
