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

/** Server addresses worth trying, most specific first. On web the page's own host is a good guess,
 *  because the backend usually runs on the same computer as the dev server. */
function candidateUrls(saved: string): string[] {
  const urls = [saved, DEFAULT_SETTINGS.apiUrl];
  const loc = (globalThis as { location?: { protocol?: string; hostname?: string } }).location;
  if (loc?.hostname && loc.protocol?.startsWith('http')) urls.push(`http://${loc.hostname}:8000`);
  return [...new Set(urls.map((u) => u.trim().replace(/\/+$/, '')).filter(Boolean))];
}

/** Finds a grading server that answers. If the saved address is stale (e.g. the laptop's Wi-Fi
 *  address changed) but another candidate works, that one is saved so every screen uses it. */
export async function findWorkingServer(ping: (url: string) => Promise<boolean>): Promise<string | null> {
  const s = await getSettings();
  for (const url of candidateUrls(s.apiUrl)) {
    if (await ping(url)) {
      if (url !== s.apiUrl) await saveSettings({ ...s, apiUrl: url });
      return url;
    }
  }
  return null;
}
