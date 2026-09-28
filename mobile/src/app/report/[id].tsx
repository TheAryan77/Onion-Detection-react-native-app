import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatCard } from '@/components/StatCard';
import { Button, Card, Pill, SectionTitle } from '@/components/ui';
import { VerdictBanner } from '@/components/VerdictBanner';
import { useShareReportWithChat } from '@/lib/chat';
import { shareReportPdf } from '@/lib/report';
import { getReport } from '@/lib/storage';
import { categoryIcon, categoryLabel, defectLabel, pageWidth, radius , makeStyles, printCategoryColor, useTheme } from '@/theme';
import type { StoredReport } from '@/types';

export default function ReportScreen() {
  const styles = useStyles();
  const { colors, categoryColor, categoryTint } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<StoredReport | null | undefined>(undefined);
  const [sharing, setSharing] = useState(false);

  useEffect(() => { if (id) getReport(id).then(setData); }, [id]);
  useShareReportWithChat(data);

  if (data === undefined) return <ActivityIndicator style={{ flex: 1 }} color={colors.brand} />;
  if (data === null) {
    return (
      <View style={[styles.inner, { padding: 16 }]}>
        <Card style={{ alignItems: 'center', gap: 10 }}>
          <Text style={styles.h2}>Report not found</Text>
          <Button label="Back to home" onPress={() => router.replace('/')} style={{ alignSelf: 'stretch' }} />
        </Card>
      </View>
    );
  }
  const { meta, result } = data;
  const s = result.summary;

  const share = async () => {
    setSharing(true);
    try { await shareReportPdf(data); }
    catch (e: any) { Alert.alert('PDF not created', e?.message ?? 'Unknown error'); }
    finally { setSharing(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.inner}>
        <VerdictBanner verdict={s.lot_verdict} total={s.total} />

        <View style={styles.row}>
          <StatCard label="Grade A" pct={s.grade_a_pct} sub={`${s.grade_a} of ${s.total} onions`} color={colors.gradeA} />
          <StatCard label="URS" pct={s.urs_pct} sub={`${s.urs} of ${s.total} onions`} color={colors.urs} />
        </View>
        {s.reject > 0 && <StatCard label="Reject" pct={s.reject_pct} sub={`${s.reject} of ${s.total} onions`} color={colors.reject} />}

        {result.warnings.map((w) => (
          <View key={w} style={styles.warn}>
            <Ionicons name="warning-outline" size={20} color={colors.warnText} />
            <Text style={styles.warnText}>{w}</Text>
          </View>
        ))}

        <SectionTitle title="Evidence image" />
        <Card style={{ padding: 8, gap: 10 }}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${result.annotated_image_b64}` }}
            style={[styles.image, { aspectRatio: result.image_width / result.image_height }]}
            resizeMode="contain"
          />
          <View style={styles.legend}>
            {(['GRADE_A', 'URS', 'REJECT'] as const).map((c) => (
              <View key={c} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: printCategoryColor[c] }]} />
                <Text style={styles.legendText}>{categoryLabel[c]}</Text>
              </View>
            ))}
          </View>
        </Card>

        <SectionTitle title="Defects found" right={<Text style={styles.hint}>onions affected</Text>} />
        <Card style={{ gap: 12 }}>
          {Object.entries(s.defect_counts).map(([k, v]) => (
            <View key={k} style={{ gap: 6 }}>
              <View style={styles.line}>
                <Text style={styles.lineLabel}>{defectLabel[k] ?? k}</Text>
                <Text style={[styles.lineValue, v > 0 && { color: colors.urs }]}>{v}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${s.total ? (100 * v) / s.total : 0}%` }]} />
              </View>
            </View>
          ))}
        </Card>

        <SectionTitle title={`Each onion (${result.onions.length})`} />
        <Card style={{ paddingVertical: 4 }}>
          {result.onions.map((o, i) => (
            <View key={o.id} style={[styles.onion, i > 0 && styles.onionDivider]}>
              <View style={styles.onionId}><Text style={styles.onionIdText}>#{o.id}</Text></View>
              <View style={{ flex: 1, gap: 4 }}>
                <Pill label={categoryLabel[o.category]} color={categoryColor[o.category]} tint={categoryTint[o.category]} icon={categoryIcon[o.category]} />
                <Text style={styles.onionReason}>
                  {o.diameter_mm ? `${o.diameter_mm} mm · ` : ''}{o.reasons.join('; ') || 'No defects detected'}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        <SectionTitle title="Record" />
        <Card style={{ paddingVertical: 6 }}>
          {[
            ['Batch', meta.batchId],
            ['Centre', meta.centreName || '—'],
            ['Operator', meta.operatorName || '—'],
            ['Time', new Date(result.created_at).toLocaleString('en-IN')],
            ['Specification', result.spec_name],
            ['Rules version', result.rules_version],
            ['Model', result.model_id],
            ['Size calibration', result.calibrated ? `${result.px_per_mm} px/mm` : 'Marker not found'],
            ['Report hash', result.report_hash.slice(0, 16) + '…'],
          ].map(([k, v], i) => (
            <View key={k} style={[styles.recordRow, i > 0 && styles.onionDivider]}>
              <Text style={styles.lineLabel}>{k}</Text>
              <Text style={styles.recordValue} numberOfLines={2}>{v}</Text>
            </View>
          ))}
        </Card>

        <Button
          label={Platform.OS === 'web' ? 'Print / save as PDF' : sharing ? 'Creating PDF…' : 'Share PDF report'}
          icon={Platform.OS === 'web' ? 'print-outline' : 'share-outline'}
          onPress={share}
          loading={sharing}
          style={{ marginTop: 6 }}
        />
        <Button
          label="Grade next batch"
          icon="camera-outline"
          variant="secondary"
          onPress={() => router.replace('/')}
        />
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  page: { padding: 16, paddingBottom: 110 }, // room for the assistant bubble
  inner: { ...pageWidth, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  warn: { flexDirection: 'row', gap: 10, backgroundColor: c.warnBg, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: c.warnBorder },
  warnText: { flex: 1, color: c.warnText, fontSize: 14, lineHeight: 20 },
  image: { width: '100%', borderRadius: radius.md, backgroundColor: '#000' },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center', paddingBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { color: c.muted, fontSize: 13 },
  hint: { fontSize: 13, color: c.faint },
  h2: { fontSize: 18, fontWeight: '800', color: c.ink },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  lineLabel: { color: c.muted, fontSize: 15 },
  lineValue: { color: c.ink, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 6, backgroundColor: c.bg, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: c.urs },
  onion: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'flex-start' },
  onionDivider: { borderTopWidth: 1, borderTopColor: c.border },
  onionId: { width: 40, height: 28, borderRadius: 8, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  onionIdText: { fontWeight: '700', color: c.ink, fontSize: 14 },
  onionReason: { color: c.muted, fontSize: 14 },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, gap: 16 },
  recordValue: { flex: 1, textAlign: 'right', color: c.ink, fontSize: 15, fontWeight: '600' },
}));
