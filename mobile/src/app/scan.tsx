import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, IconBubble } from '@/components/ui';
import { pickFromLibrary, startAnalysis } from '@/lib/pending';
import {  makeStyles, useTheme } from '@/theme';
import type { ScanMode } from '@/types';

const TIPS: Record<ScanMode, string> = {
  batch: 'Onions spaced apart on the blue sheet, marker fully visible. Hold the phone flat above them.',
  single: 'One onion on the blue sheet with the marker beside it. Hold the phone flat above it.',
};

export default function Scan() {
  const styles = useStyles();
  const { colors, categoryColor, categoryTint } = useTheme();
  const { mode = 'batch' } = useLocalSearchParams<{ mode?: ScanMode }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const insets = useSafeAreaInsets();

  const pick = async () => {
    const uri = await pickFromLibrary();
    if (uri) startAnalysis(uri, mode, { replace: true });
  };

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;
  }
  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <IconBubble name="camera-outline" color={colors.brand} tint={colors.brandSoft} size={72} />
        <Text style={styles.permTitle}>Allow camera access</Text>
        <Text style={styles.permText}>The camera is used to photograph onion samples on the grading sheet.</Text>
        <Button label="Allow camera" icon="camera" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
        <Button label="Choose from gallery instead" icon="images-outline" variant="secondary" onPress={pick} style={{ alignSelf: 'stretch' }} />
        <Pressable onPress={() => router.back()}><Text style={styles.cancel}>Go back</Text></Pressable>
      </View>
    );
  }

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) startAnalysis(photo.uri, mode, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
      {/* Overlay is a sibling of CameraView, not a child */}
      <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable style={styles.roundBtn} onPress={() => router.back()} accessibilityLabel="Close camera">
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <View style={styles.modeChip}>
            <Text style={styles.modeChipText}>{mode === 'single' ? 'Single onion' : 'Batch'}</Text>
          </View>
          <Pressable style={styles.roundBtn} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} accessibilityLabel="Flip camera">
            <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.tip}>
          <Ionicons name="information-circle-outline" size={20} color="#A7E3BD" />
          <Text style={styles.tipText}>{TIPS[mode]}</Text>
        </View>
        <View style={styles.frame} pointerEvents="none">
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => <View key={c} style={[styles.corner, cornerStyle[c]]} />)}
        </View>
        <View style={styles.controls}>
          <Pressable style={styles.sideBtn} onPress={pick} accessibilityLabel="Choose from gallery">
            <Ionicons name="images-outline" size={24} color="#fff" />
            <Text style={styles.sideText}>Gallery</Text>
          </Pressable>
          <Pressable style={[styles.shutter, busy && { opacity: 0.5 }]} onPress={capture} disabled={busy} accessibilityLabel="Take photo">
            <View style={styles.shutterInner}>{busy ? <ActivityIndicator color={colors.brand} /> : null}</View>
          </Pressable>
          <View style={styles.sideBtn} />
        </View>
      </View>
    </View>
  );
}

const C = 28;
const cornerStyle = {
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 18 },
};

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  permTitle: { fontSize: 22, fontWeight: '800', color: c.ink, marginTop: 8 },
  permText: { fontSize: 15, color: c.muted, textAlign: 'center', lineHeight: 21, marginBottom: 8 },
  cancel: { color: c.muted, fontSize: 15, marginTop: 4 },
  // RN 0.86 removed StyleSheet.absoluteFillObject; absoluteFill is now a plain style object
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', paddingHorizontal: 16, gap: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  modeChip: { backgroundColor: 'rgba(11,59,34,0.85)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  modeChipText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tip: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, padding: 12 },
  tipText: { flex: 1, color: '#fff', fontSize: 14, lineHeight: 20 },
  frame: { flex: 1, marginVertical: 4 },
  corner: { position: 'absolute', width: C, height: C, borderColor: '#fff' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideBtn: { width: 76, alignItems: 'center', gap: 4 },
  sideText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
}));
