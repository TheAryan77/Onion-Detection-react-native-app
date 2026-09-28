import { Platform } from 'react-native';
import type { AnalysisResult, ChatMessage, ChatReport, ScanMode } from '@/types';
import type { AppSettings } from '@/lib/settings';

const base = (url: string) => url.trim().replace(/\/+$/, '');

export async function analyzeImage(uri: string, mode: ScanMode, s: AppSettings): Promise<AnalysisResult> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    // Browsers need a real Blob; the uri is a blob: or data: URL from the picker, drop zone or camera
    form.append('file', await (await fetch(uri)).blob(), 'onions.jpg');
  } else {
    // React Native's FormData accepts { uri, name, type } for files. Do not set Content-Type yourself.
    form.append('file', { uri, name: 'onions.jpg', type: 'image/jpeg' } as any);
  }
  form.append('mode', mode);
  form.append('marker_mm', String(s.markerMm));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(`${base(s.apiUrl)}/analyze`, {
      method: 'POST',
      body: form,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = await res.text();
      try { detail = JSON.parse(detail).detail ?? detail; } catch {}
      throw new Error(`Server error ${res.status}: ${String(detail).slice(0, 200)}`);
    }
    return (await res.json()) as AnalysisResult;
  } finally {
    clearTimeout(timer);
  }
}

/** Also wakes up a sleeping free-tier server when the Home screen opens. */
export async function pingHealth(apiUrl: string, timeoutMs = 10_000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base(apiUrl)}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Ask the grading assistant. The backend holds the AI key and adds the grading rules to the prompt. */
export async function askAssistant(apiUrl: string, messages: ChatMessage[], report: ChatReport | null): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${base(apiUrl)}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ messages, report }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 404) throw new Error('This grading server is an older version without the assistant. Restart the backend.');
    if (!res.ok) throw new Error(body.detail ?? `Server error ${res.status}`);
    return body.reply as string;
  } finally {
    clearTimeout(timer);
  }
}
