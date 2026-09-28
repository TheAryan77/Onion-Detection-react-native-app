import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { askAssistant } from '@/api/client';
import { useChatReport } from '@/lib/chat';
import { getSettings } from '@/lib/settings';
import { radius, makeStyles, useTheme } from '@/theme';
import type { ChatMessage } from '@/types';

const HIDDEN_ON = ['/scan', '/analyze'];

const SUGGESTIONS_WITH_REPORT = ['Why did this lot get this verdict?', 'Which onions failed and why?', 'इस रिपोर्ट को हिंदी में समझाइए'];
const SUGGESTIONS_GENERAL = ['How do I take a good photo?', 'What does URS mean?', 'ग्रेड A के लिए क्या नियम हैं?'];

// The model is asked for plain text; strip stray markdown emphasis just in case.
const clean = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#+\s*/gm, '');

export function ChatBubble() {
  const styles = useStyles();
  const { colors, categoryColor, categoryTint } = useTheme();
  const pathname = usePathname();
  const report = useChatReport();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  // A different report is a new conversation
  useEffect(() => { setMessages([]); setError(null); }, [report?.batchId]);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', text: q }];
    setMessages(next);
    setInput('');
    setError(null);
    setBusy(true);
    try {
      const { apiUrl } = await getSettings();
      const reply = await askAssistant(apiUrl, next, report);
      setMessages([...next, { role: 'assistant', text: clean(reply) }]);
    } catch (e: any) {
      setError(
        e?.name === 'AbortError' ? 'The assistant took too long to answer. Try again.'
          : /Network request failed|Failed to fetch|NetworkError/.test(e?.message ?? '')
            ? 'Could not reach the grading server. Check Settings.'
            : (e?.message ?? 'The assistant could not answer.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const suggestions = report ? SUGGESTIONS_WITH_REPORT : SUGGESTIONS_GENERAL;

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 20 }, pressed && { transform: [{ scale: 0.95 }] }]}
        onPress={() => setOpen(true)}
        accessibilityLabel="Open grading assistant"
      >
        <Ionicons name="chatbubble-ellipses" size={26} color={colors.onBrand} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap} pointerEvents="box-none">
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.header}>
              <View style={styles.avatar}><Ionicons name="leaf" size={18} color={colors.onBrand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Grading assistant</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {report ? `Looking at ${report.batchId}` : 'Ask about grading, rules or photos'}
                </Text>
              </View>
              <Pressable style={styles.close} onPress={() => setOpen(false)} accessibilityLabel="Close assistant">
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView
              ref={scroll}
              style={styles.list}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 ? (
                <View style={[styles.msg, styles.bot]}>
                  <Text style={styles.botText}>
                    Namaste! I explain grades, the rules and how to take better photos. You can ask in English, हिंदी or मराठी.
                  </Text>
                </View>
              ) : null}
              {messages.map((m, i) => (
                <View key={i} style={[styles.msg, m.role === 'user' ? styles.user : styles.bot]}>
                  <Text style={m.role === 'user' ? styles.userText : styles.botText} selectable>{m.text}</Text>
                </View>
              ))}
              {busy ? (
                <View style={[styles.msg, styles.bot, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                  <ActivityIndicator size="small" color={colors.brand} />
                  <Text style={styles.botText}>Thinking…</Text>
                </View>
              ) : null}
              {error ? (
                <View style={styles.error}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.reject} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>

            {messages.length === 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
                {suggestions.map((s) => (
                  <Pressable key={s} style={styles.chip} onPress={() => send(s)}>
                    <Text style={styles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Ask a question…"
                placeholderTextColor={colors.faint}
                onSubmitEditing={() => send(input)}
                returnKeyType="send"
                multiline={false}
              />
              <Pressable
                style={[styles.send, (!input.trim() || busy) && { opacity: 0.4 }]}
                onPress={() => send(input)}
                disabled={!input.trim() || busy}
                accessibilityLabel="Send"
              >
                <Ionicons name="arrow-up" size={20} color={colors.onBrand} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  fab: {
    position: 'absolute', right: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: c.brand,
    alignItems: 'center', justifyContent: 'center', boxShadow: '0px 6px 18px rgba(11, 59, 34, 0.35)',
  },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: c.backdrop },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '78%',
    width: '100%', maxWidth: 640, alignSelf: 'center', overflow: 'hidden', boxShadow: c.shadow,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: c.ink },
  subtitle: { fontSize: 13, color: c.muted, marginTop: 1 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
  list: { flex: 1 },
  msg: { maxWidth: '85%', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bot: { alignSelf: 'flex-start', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 6 },
  user: { alignSelf: 'flex-end', backgroundColor: c.brand, borderBottomRightRadius: 6 },
  botText: { color: c.ink, fontSize: 15, lineHeight: 22 },
  userText: { color: c.onBrand, fontSize: 15, lineHeight: 22 },
  error: { flexDirection: 'row', gap: 8, backgroundColor: c.tintReject, borderRadius: radius.md, padding: 12 },
  errorText: { flex: 1, color: c.reject, fontSize: 14, lineHeight: 20 },
  chipRow: { flexGrow: 0, flexShrink: 0 }, // a horizontal ScrollView otherwise stretches to fill the sheet
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 10, alignItems: 'center' },
  chip: { backgroundColor: c.brandSoft, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  chipText: { color: c.brand, fontSize: 14, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card },
  input: { flex: 1, backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: c.ink, borderWidth: 1, borderColor: c.border },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' },
}));
