import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { printCategoryColor as categoryColor, categoryLabel, defectLabel } from '@/theme';
import type { StoredReport } from '@/types';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function buildReportHtml({ meta, result }: StoredReport): string {
  const s = result.summary;
  const verdictColor = categoryColor[s.lot_verdict];
  const defectRows = Object.entries(s.defect_counts)
    .map(([k, v]) => `<tr><td>${esc(defectLabel[k] ?? k)}</td><td class="num">${v}</td></tr>`)
    .join('');
  const onionRows = result.onions
    .map(
      (o) => `<tr>
        <td>#${o.id}</td>
        <td class="num">${o.diameter_mm ?? '—'}</td>
        <td style="color:${categoryColor[o.category]};font-weight:700">${categoryLabel[o.category]}</td>
        <td>${esc(o.reasons.join('; ') || 'No defects detected')}</td>
      </tr>`,
    )
    .join('');
  const when = new Date(result.created_at).toLocaleString('en-IN');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, 'Noto Sans', sans-serif; color:#10231A; margin:28px; font-size:12px; }
  h1 { font-size:22px; margin:0 0 4px; color:#0B3B22; }
  .brandbar { height:6px; background:linear-gradient(90deg,#0B3B22,#1F8A4C); border-radius:3px; margin-bottom:18px; }
  .sub { color:#5E6E66; margin-bottom:16px; }
  .verdict { background:${verdictColor}; color:#fff; padding:14px 18px; border-radius:10px; font-size:20px; font-weight:700; }
  .stats { display:flex; gap:12px; margin:14px 0; }
  .stat { flex:1; border:1px solid #E2EAE5; border-radius:10px; padding:12px; }
  .stat b { font-size:26px; display:block; }
  table { width:100%; border-collapse:collapse; margin:10px 0 18px; }
  th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #E2EAE5; vertical-align:top; }
  th { color:#5E6E66; font-weight:600; }
  .num { text-align:right; font-variant-numeric: tabular-nums; }
  img { width:100%; border-radius:8px; margin:6px 0 14px; }
  .meta td:first-child { color:#5E6E66; width:34%; }
  .foot { color:#5E6E66; font-size:10px; margin-top:18px; line-height:1.5; word-break:break-all; }
  h2 { font-size:14px; margin:18px 0 4px; }
</style></head><body>
  <div class="brandbar"></div>
  <h1>Onion quality report</h1>
  <div class="sub">Batch ${esc(meta.batchId)} · ${esc(when)}</div>
  <div class="verdict">Lot verdict: ${categoryLabel[s.lot_verdict]}</div>
  <div class="stats">
    <div class="stat"><b style="color:${categoryColor.GRADE_A}">${s.grade_a_pct}%</b>Grade A (${s.grade_a} of ${s.total})</div>
    <div class="stat"><b style="color:${categoryColor.URS}">${s.urs_pct}%</b>URS (${s.urs} of ${s.total})</div>
    ${s.reject ? `<div class="stat"><b style="color:${categoryColor.REJECT}">${s.reject_pct}%</b>Reject (${s.reject})</div>` : ''}
  </div>

  <h2>Evidence image</h2>
  <img src="data:image/jpeg;base64,${result.annotated_image_b64}" />

  <h2>Defects found (onions affected)</h2>
  <table>${defectRows}</table>

  <h2>Per-onion assessment</h2>
  <table><tr><th>Onion</th><th class="num">Diameter (mm)</th><th>Grade</th><th>Reason</th></tr>${onionRows}</table>

  <h2>Record</h2>
  <table class="meta">
    <tr><td>Procurement centre</td><td>${esc(meta.centreName || '—')}</td></tr>
    <tr><td>Operator</td><td>${esc(meta.operatorName || '—')}</td></tr>
    <tr><td>Grading specification</td><td>${esc(result.spec_name)}</td></tr>
    <tr><td>Rules version</td><td>${esc(result.rules_version)}</td></tr>
    <tr><td>Detection model</td><td>${esc(result.model_id)}</td></tr>
    <tr><td>Size calibration</td><td>${result.calibrated ? `Marker found (${result.px_per_mm} px/mm)` : 'Marker not found — sizes not measured'}</td></tr>
  </table>
  ${result.warnings.length ? `<p><b>Warnings:</b> ${result.warnings.map(esc).join(' ')}</p>` : ''}
  <div class="foot">
    Report hash (SHA-256): ${result.report_hash}<br/>
    Automated assessment to support the grader. Grades follow the rules file named above; detections are shown on the evidence image for verification.
  </div>
</body></html>`;
}

export async function shareReportPdf(report: StoredReport): Promise<void> {
  if (Platform.OS === 'web') {
    // expo-print on web only prints the current page, so print the report from its own window
    const w = window.open('', '_blank');
    if (!w) throw new Error('Allow pop-ups for this site to print the report.');
    w.document.write(buildReportHtml(report));
    w.document.close();
    w.onload = () => w.print();
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: buildReportHtml(report) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share quality report' });
  }
}
