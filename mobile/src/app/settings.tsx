import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { pingHealth } from '@/api/client';
import { ThemePicker } from '@/components/ThemeToggle';
import { Button, Card, SectionTitle } from '@/components/ui';
import { AppSettings, getSettings, saveSettings } from '@/lib/settings';
import { pageWidth, radius , makeStyles, useTheme } from '@/theme';

type Status = { text: string; tone: 'ok' | 'bad' | 'info' } | null;

export default function SettingsScreen() {
  const styles = useStyles();
  const { colors, categoryColor, categoryTint } = useTheme();
  const [s, setS] = useState<AppSettings | null>(null);
  const [markerText, setMarkerText] = useState('50');
  const [status, setStatus] = useState<Status>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getSettings().then((v) => { setS(v); setMarkerText(String(v.markerMm)); });
  }, []);

  if (!s) return <ActivityIndicator style={{ flex: 1 }} color={colors.brand} />;

  const save = async () => {
    const markerMm = parseFloat(markerText);
    if (!(markerMm >= 10 && markerMm <= 300)) { setStatus({ text: 'Marker size must be between 10 and 300 mm.', tone: 'bad' }); return; }
    const next = { ...s, markerMm };
    await saveSettings(next);
    setS(next);
    setStatus({ text: 'Settings saved.', tone: 'ok' });
  };

  const test = async () => {
    setTesting(true);
    setStatus({ text: 'Checking server…', tone: 'info' });
    const ok = await pingHealth(s.apiUrl, 60_000);
    setStatus(ok ? { text: 'Server connected.', tone: 'ok' } : { text: 'Server not reachable at this address.', tone: 'bad' });
    setTesting(false);
  };

  const field = (label: string, hint: string, value: string, onChange: (t: string) => void, extra: object = {}) => (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.faint}
        {...extra}
      />
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );

  const toneColor = { ok: colors.gradeA, bad: colors.reject, info: colors.muted };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <SectionTitle title="Appearance" />
        <Card>
          <ThemePicker />
        </Card>

        <SectionTitle title="Grading server" />
        <Card style={{ gap: 16 }}>
          {field('Server address', 'Your Mac’s LAN address, a tunnel URL or the deployed backend.', s.apiUrl, (t) => setS({ ...s, apiUrl: t }), { keyboardType: 'url', placeholder: 'https://…' })}
          <Button label="Test connection" icon="pulse-outline" variant="secondary" onPress={test} loading={testing} />
        </Card>

        <SectionTitle title="Calibration" />
        <Card>
          {field('Marker size (mm)', 'Measure the printed black square with a ruler.', markerText, setMarkerText, { keyboardType: 'decimal-pad' })}
        </Card>

        <SectionTitle title="Report details" />
        <Card style={{ gap: 16 }}>
          {field('Procurement centre', 'Printed on every report.', s.centreName, (t) => setS({ ...s, centreName: t }), { autoCapitalize: 'words', placeholder: 'e.g. Lasalgaon APMC' })}
          {field('Operator name', 'Who took the photo.', s.operatorName, (t) => setS({ ...s, operatorName: t }), { autoCapitalize: 'words', placeholder: 'Your name' })}
        </Card>

        {status ? (
          <View style={styles.status}>
            <Ionicons
              name={status.tone === 'ok' ? 'checkmark-circle' : status.tone === 'bad' ? 'alert-circle' : 'time-outline'}
              size={18}
              color={toneColor[status.tone]}
            />
            <Text style={[styles.statusText, { color: toneColor[status.tone] }]}>{status.text}</Text>
          </View>
        ) : null}
        <Button label="Save settings" icon="checkmark" onPress={save} />
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  page: { padding: 16, paddingBottom: 110 }, // room for the assistant bubble
  inner: { ...pageWidth, gap: 12 },
  label: { fontSize: 15, fontWeight: '700', color: c.ink },
  hint: { fontSize: 13, color: c.muted },
  input: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: c.ink },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  statusText: { fontSize: 15, fontWeight: '600' },
}));
