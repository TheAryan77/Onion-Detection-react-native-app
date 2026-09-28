import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { pingHealth } from '@/api/client';
import { DropZone } from '@/components/DropZone';
import { ModeToggle } from '@/components/ModeToggle';
import { ThemeToggleButton } from '@/components/ThemeToggle';
import { Card, IconBubble, Pill, SectionTitle, type IconName } from '@/components/ui';
import { pickFromLibrary, startAnalysis } from '@/lib/pending';
import { getSettings } from '@/lib/settings';
import { listReports } from '@/lib/storage';
import { categoryIcon, categoryLabel, pageWidth, radius , makeStyles, useTheme } from '@/theme';
import type { ReportMeta, ScanMode } from '@/types';

const TIPS: { icon: IconName; text: string }[] = [
  { icon: 'square-outline', text: 'Plain matte blue sheet filling the whole frame' },
  { icon: 'qr-code-outline', text: 'Printed 50 mm marker lying flat, fully visible' },
  { icon: 'resize-outline', text: 'Onions ~2 cm apart; phone flat, 40–60 cm above' },
  { icon: 'sunny-outline', text: 'Even daylight or tube light, no hard shadows' },
];

export default function Home() {
  const styles = useStyles();
  const { colors, categoryColor, categoryTint } = useTheme();
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [mode, setMode] = useState<ScanMode>('batch');

  useFocusEffect(
    useCallback(() => {
      listReports().then(setReports);
      getSettings().then((s) => pingHealth(s.apiUrl)).then(setOnline);
    }, []),
  );

  const openCamera = () => router.push({ pathname: '/scan', params: { mode } });
  const openGallery = async () => {
    const uri = await pickFromLibrary();
    if (uri) startAnalysis(uri, mode);
  };

  const status = online == null
    ? { label: 'Checking server…', color: colors.muted, tint: colors.tintNone }
    : online
      ? { label: 'Server connected', color: colors.gradeA, tint: colors.tintA }
      : { label: 'Server offline', color: colors.reject, tint: colors.tintReject };

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 16 }]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>Onion Grader</Text>
            <Text style={styles.tagline}>AI quality assessment for procurement centres</Text>
          </View>
          <ThemeToggleButton />
          <Pressable style={styles.iconBtn} onPress={() => router.push('/settings')} accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={22} color={colors.brand} />
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/settings')}>
          <Pill label={status.label} color={status.color} tint={status.tint} icon="ellipse" />
        </Pressable>

        <LinearGradient colors={[colors.heroFrom, colors.heroTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroEyebrow}>New assessment</Text>
          <Text style={styles.heroTitle}>Grade onions in seconds</Text>
          <Text style={styles.heroSub}>Detects cuts, rot, sprouting and undersized bulbs, then applies the grading rules.</Text>
          <ModeToggle value={mode} onChange={setMode} onHero />
          <View style={styles.heroActions}>
            <Pressable style={[styles.heroBtn, styles.heroBtnPrimary]} onPress={openCamera}>
              <Ionicons name="camera" size={20} color={colors.heroBtnText} />
              <Text style={[styles.heroBtnText, { color: colors.heroBtnText }]}>Take photo</Text>
            </Pressable>
            <Pressable style={[styles.heroBtn, styles.heroBtnGhost]} onPress={openGallery}>
              <Ionicons name="images-outline" size={20} color={colors.heroGhostText} />
              <Text style={[styles.heroBtnText, { color: colors.heroGhostText }]}>{Platform.OS === 'web' ? 'Browse' : 'Gallery'}</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <DropZone onFile={(uri) => startAnalysis(uri, mode)} />

        <SectionTitle title="For accurate results" />
        <Card style={{ gap: 12 }}>
          {TIPS.map((t) => (
            <View key={t.text} style={styles.tip}>
              <IconBubble name={t.icon} color={colors.brand} tint={colors.brandSoft} size={34} />
              <Text style={styles.tipText}>{t.text}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle
          title="Recent reports"
          right={reports.length ? <Text style={styles.count}>{reports.length} saved</Text> : null}
        />
        {reports.length === 0 ? (
          <Card style={styles.empty}>
            <IconBubble name="document-text-outline" color={colors.faint} tint={colors.input} size={52} />
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyText}>Take or upload a photo to create the first quality report.</Text>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {reports.map((r) => (
              <Pressable
                key={r.id}
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.8 }]}
                onPress={() => router.push({ pathname: '/report/[id]', params: { id: r.id } })}
              >
                <IconBubble name={categoryIcon[r.lotVerdict]} color={categoryColor[r.lotVerdict]} tint={categoryTint[r.lotVerdict]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{r.batchId}</Text>
                  <Text style={styles.itemSub}>
                    {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {r.total} onions · {r.mode === 'single' ? 'single' : 'batch'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.itemPct}>{r.gradeAPct}%</Text>
                  <Text style={[styles.itemVerdict, { color: categoryColor[r.lotVerdict] }]}>{categoryLabel[r.lotVerdict]}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.faint} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  page: { padding: 16, paddingBottom: 110 }, // room for the assistant bubble
  inner: { ...pageWidth, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontSize: 28, fontWeight: '800', color: c.ink, letterSpacing: -0.6 },
  tagline: { fontSize: 14, color: c.muted, marginTop: 2 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: radius.lg + 4, padding: 20, gap: 12 },
  heroEyebrow: { color: c.heroEyebrow, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { color: c.heroText, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: -4 },
  heroSub: { color: c.heroSub, fontSize: 15, lineHeight: 21 },
  heroActions: { flexDirection: 'row', gap: 10 },
  heroBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.md },
  heroBtnPrimary: { backgroundColor: c.heroBtnBg },
  heroBtnGhost: { backgroundColor: c.heroGhostBg, borderWidth: 1, borderColor: c.heroGhostBorder },
  heroBtnText: { fontSize: 16, fontWeight: '700' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipText: { flex: 1, fontSize: 15, color: c.ink, lineHeight: 20 },
  count: { fontSize: 13, color: c.muted },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 28 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: c.ink, marginTop: 4 },
  emptyText: { fontSize: 14, color: c.muted, textAlign: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: c.border },
  itemTitle: { fontSize: 15, fontWeight: '700', color: c.ink },
  itemSub: { fontSize: 13, color: c.muted, marginTop: 2 },
  itemPct: { fontSize: 17, fontWeight: '800', color: c.ink, fontVariant: ['tabular-nums'] },
  itemVerdict: { fontSize: 12, fontWeight: '700' },
}));
