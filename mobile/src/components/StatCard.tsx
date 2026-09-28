import { Text, View } from 'react-native';
import { makeStyles, radius } from '@/theme';

/** Big percentage with a thin progress bar underneath. */
export function StatCard({ label, pct, sub, color }: { label: string; pct: number; sub?: string; color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{pct}%</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }]} />
      </View>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flex: 1, backgroundColor: c.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: c.border, boxShadow: c.shadow },
  label: { fontSize: 14, color: c.muted, fontWeight: '600' },
  value: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2, letterSpacing: -0.5 },
  track: { height: 6, backgroundColor: c.input, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  sub: { fontSize: 13, color: c.muted, marginTop: 8 },
}));
