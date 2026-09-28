import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { analyzeImage } from '@/api/client';
import { Button, Card, IconBubble } from '@/components/ui';
import { prepareForUpload } from '@/lib/image';
import { takePending } from '@/lib/pending';
import { getSettings } from '@/lib/settings';
import { saveReport } from '@/lib/storage';
import { pageWidth, radius , makeStyles, useTheme } from '@/theme';

const STEPS = ['Preparing photo', 'Uploading to grading server', 'Finding cuts, rot and sprouting', 'Measuring onion size', 'Applying grading rules'];

export default function Analyze() {
  const styles = useStyles();
  const { colors, categoryColor, categoryTint } = useTheme();
  // Read once: the photo is handed over in memory (see lib/pending.ts), and "Try again" reuses it
  const [job] = useState(takePending);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(job ? null : 'No photo was selected. Go back and take or choose a photo.');

  const run = useCallback(async () => {
    if (!job) return;
    setError(null);
    setStep(0);
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      const settings = await getSettings();
      const prepared = await prepareForUpload(job.uri);
      setStep(1);
      // The server does these steps in one request; the ticker only shows the user what is happening.
      timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1200);
      const result = await analyzeImage(prepared, job.mode, settings);
      const id = await saveReport(result, settings);
      router.replace({ pathname: '/report/[id]', params: { id } });
    } catch (e: any) {
      setError(
        e?.name === 'AbortError'
          ? 'The server took too long to respond. A free-tier server may still be waking up. Try again in a moment.'
          : /Network request failed|Failed to fetch|NetworkError/.test(e?.message ?? '')
            ? 'Could not reach the grading server. Check the server address in Settings and that the device is online.'
            : (e?.message ?? 'Grading failed.'),
      );
    } finally {
      if (timer) clearInterval(timer);
    }
  }, [job]);

  useEffect(() => { run(); }, [run]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.inner}>
        {job ? <Image source={{ uri: job.uri }} style={styles.photo} resizeMode="cover" /> : null}

        {error ? (
          <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
            <IconBubble name="cloud-offline-outline" color={colors.reject} tint={colors.tintReject} size={60} />
            <Text style={styles.errTitle}>Grading didn't finish</Text>
            <Text style={styles.errText}>{error}</Text>
            {job ? <Button label="Try again" icon="refresh" onPress={run} style={{ alignSelf: 'stretch', marginTop: 12 }} /> : null}
            <Button label="Settings" icon="settings-outline" variant="secondary" onPress={() => router.push('/settings')} style={{ alignSelf: 'stretch' }} />
            <Button label="Back to home" variant="ghost" onPress={() => router.replace('/')} style={{ alignSelf: 'stretch' }} />
          </Card>
        ) : (
          <Card style={{ gap: 14 }}>
            <Text style={styles.title}>Grading your {job?.mode === 'single' ? 'onion' : 'batch'}…</Text>
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <View key={label} style={styles.stepRow}>
                  {done ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.gradeA} />
                  ) : active ? (
                    <ActivityIndicator size="small" color={colors.brand} style={{ width: 22 }} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={22} color={colors.border} />
                  )}
                  <Text style={[styles.step, done && styles.done, active && styles.active]}>{label}</Text>
                </View>
              );
            })}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  page: { padding: 16, paddingBottom: 40 },
  inner: { ...pageWidth, gap: 14 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: c.border },
  title: { fontSize: 18, fontWeight: '800', color: c.ink },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { fontSize: 16, color: c.faint },
  done: { color: c.ink },
  active: { color: c.ink, fontWeight: '700' },
  errTitle: { fontSize: 20, fontWeight: '800', color: c.ink, marginTop: 6 },
  errText: { fontSize: 15, color: c.muted, lineHeight: 21, textAlign: 'center' },
}));
