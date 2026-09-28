import { Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Segmented } from '@/components/ui';
import { makeStyles, useTheme, type ThemeMode } from '@/theme';

/** Round header button that flips between the light and green themes. */
export function ThemeToggleButton() {
  const styles = useStyles();
  const { mode, toggle, colors } = useTheme();
  return (
    <Pressable
      style={styles.iconBtn}
      onPress={toggle}
      accessibilityLabel={mode === 'light' ? 'Switch to green theme' : 'Switch to light theme'}
    >
      <Ionicons name={mode === 'light' ? 'leaf-outline' : 'sunny-outline'} size={22} color={colors.brand} />
    </Pressable>
  );
}

const OPTIONS: { value: ThemeMode; label: string; icon: 'sunny-outline' | 'leaf-outline' }[] = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'green', label: 'Green', icon: 'leaf-outline' },
];

export function ThemePicker() {
  const { mode, setMode } = useTheme();
  return <Segmented options={OPTIONS} value={mode} onChange={setMode} />;
}

const useStyles = makeStyles((c) => ({
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
}));
