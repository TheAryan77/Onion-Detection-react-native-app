import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { makeStyles, radius, useTheme, type Palette } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const buttonColors = (c: Palette): Record<ButtonVariant, { box: ViewStyle; fg: string }> => ({
  primary: { box: { backgroundColor: c.brand }, fg: c.onBrand },
  secondary: { box: { backgroundColor: c.brandSoft }, fg: c.onBrandSoft },
  ghost: { box: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.border }, fg: c.ink },
});

export function Button({
  label, icon, onPress, variant = 'primary', loading, disabled, style,
}: {
  label: string; icon?: IconName; onPress: () => void; variant?: ButtonVariant;
  loading?: boolean; disabled?: boolean; style?: ViewStyle;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const v = buttonColors(colors)[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.btn, v.box, (pressed || disabled) && { opacity: 0.75 }, style]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : icon ? <Ionicons name={icon} size={20} color={v.fg} /> : null}
      <Text style={[styles.btnText, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, color, tint, icon }: { label: string; color: string; tint: string; icon?: IconName }) {
  const styles = useStyles();
  return (
    <View style={[styles.pill, { backgroundColor: tint }]}>
      {icon ? <Ionicons name={icon} size={14} color={color} /> : null}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function IconBubble({ name, color, tint, size = 40 }: { name: IconName; color: string; tint: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size * 0.52} color={color} />
    </View>
  );
}

/** Segmented control. `hero` styles it for the hero card, `plain` for ordinary cards. */
export function Segmented<T extends string>({
  options, value, onChange, variant = 'plain',
}: {
  options: { value: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void; variant?: 'hero' | 'plain';
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const hero = variant === 'hero';
  const activeBg = hero ? colors.heroBtnBg : '#FFFFFF';
  const activeFg = hero ? colors.heroBtnText : '#0B3B22';
  const idleFg = hero ? colors.heroSegText : colors.onBrandSoft;
  return (
    <View style={[styles.track, { backgroundColor: hero ? colors.heroTrack : colors.brandSoft }]}>
      {options.map((o) => {
        const active = o.value === value;
        const fg = active ? activeFg : idleFg;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.seg, active && { backgroundColor: activeBg }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {o.icon ? <Ionicons name={o.icon} size={16} color={fg} /> : null}
            <Text style={[styles.segLabel, { color: fg }, active && { fontWeight: '700' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: c.border, boxShadow: c.shadow },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: 18 },
  btnText: { fontSize: 16, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  pillText: { fontSize: 13, fontWeight: '700' },
  track: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  seg: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 9, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segLabel: { fontSize: 14, fontWeight: '600' },
}));
