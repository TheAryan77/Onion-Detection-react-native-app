import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import type { ScanMode } from '@/types';

// Hands the chosen photo to the Analyze screen in memory. Passing it as a route param would put
// multi-MB data/blob URIs into the URL on web.
let pending: { uri: string; mode: ScanMode } | null = null;

export function startAnalysis(uri: string, mode: ScanMode, opts: { replace?: boolean } = {}) {
  pending = { uri, mode };
  if (opts.replace) router.replace('/analyze');
  else router.push('/analyze');
}

export function takePending() {
  const p = pending;
  pending = null;
  return p;
}

export async function pickFromLibrary(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  return !res.canceled && res.assets?.[0] ? res.assets[0].uri : null;
}
