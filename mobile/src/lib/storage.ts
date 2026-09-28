import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnalysisResult, ReportMeta, StoredReport } from '@/types';

// Each report holds a ~200–300 KB base64 image, so keep only the latest 10 (AsyncStorage on Android is small).
const INDEX_KEY = 'reports:index:v1';
const MAX_REPORTS = 10;
const itemKey = (id: string) => `reports:item:${id}`;

function makeBatchId(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `ON-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function listReports(): Promise<ReportMeta[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getReport(id: string): Promise<StoredReport | null> {
  const raw = await AsyncStorage.getItem(itemKey(id));
  return raw ? JSON.parse(raw) : null;
}

export async function saveReport(
  result: AnalysisResult,
  ctx: { centreName: string; operatorName: string },
): Promise<string> {
  const meta: ReportMeta = {
    id: result.report_id,
    batchId: makeBatchId(),
    createdAt: result.created_at,
    mode: result.mode,
    total: result.summary.total,
    gradeAPct: result.summary.grade_a_pct,
    ursPct: result.summary.urs_pct,
    lotVerdict: result.summary.lot_verdict,
    centreName: ctx.centreName,
    operatorName: ctx.operatorName,
  };
  await AsyncStorage.setItem(itemKey(meta.id), JSON.stringify({ meta, result }));
  const index = [meta, ...(await listReports())];
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, MAX_REPORTS)));
  const dropped = index.slice(MAX_REPORTS);
  if (dropped.length) await AsyncStorage.multiRemove(dropped.map((m) => itemKey(m.id)));
  return meta.id;
}

export async function deleteReport(id: string): Promise<void> {
  const index = (await listReports()).filter((m) => m.id !== id);
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
  await AsyncStorage.removeItem(itemKey(id));
}
