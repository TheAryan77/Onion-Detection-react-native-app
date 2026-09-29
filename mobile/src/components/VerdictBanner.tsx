import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { categoryIcon, categoryLabel, makeStyles, radius, useTheme } from '@/theme';
import type { LotVerdict } from '@/types';

export function VerdictBanner({ verdict, total }: { verdict: LotVerdict; total: number }) {
  const styles = useStyles();
  const { categoryColor, categoryTint } = useTheme();
  const color = categoryColor[verdict];
  return (
    <View style={[styles.box, { backgroundColor: categoryTint[verdict], borderColor: color + '44' }]}>
      <Ionicons name={categoryIcon[verdict]} size={44} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.caption, { color }]}>Lot verdict · {total} {total === 1 ? 'onion' : 'onions'} checked</Text>
        <Text style={[styles.title, { color }]}>{categoryLabel[verdict]}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  box: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, paddingVertical: 18, paddingHorizontal: 18, borderWidth: 1 },
  caption: { fontSize: 14, fontWeight: '600', opacity: 0.85 },
  title: { fontSize: 30, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
}));
