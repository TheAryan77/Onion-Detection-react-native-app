import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  apiUrl: string;
  markerMm: number;
  centreName: string;
  operatorName: string;
}

const KEY = 'settings:v1';

export const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.10:8000',
  markerMm: 50,
  centreName: '',
  operatorName: '',
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}
