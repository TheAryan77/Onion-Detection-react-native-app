import { useRef, useState, type DragEvent } from 'react';
import { Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { radius, useTheme } from '@/theme';

/** Browser-only drag-and-drop target that also opens the file chooser on click. */
export function DropZone({ onFile }: { onFile: (uri: string) => void }) {
  const { colors } = useTheme();
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const take = (file?: File | null) => {
    if (file && file.type.startsWith('image/')) onFile(URL.createObjectURL(file));
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files?.[0]);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${over ? colors.brand : colors.faint}`,
        background: over ? colors.brandSoft : colors.card,
        borderRadius: radius.lg,
        padding: '26px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        transition: 'background 120ms, border-color 120ms',
      }}
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }}
      />
      <Ionicons name="cloud-upload-outline" size={34} color={colors.brand} />
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
        {over ? 'Drop to grade this photo' : 'Drag & drop an onion photo'}
      </Text>
      <Text style={{ fontSize: 14, color: colors.muted }}>or click to browse · JPG, PNG</Text>
    </div>
  );
}
