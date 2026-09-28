import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChatBubble } from '@/components/ChatBubble';
import { ChatProvider } from '@/lib/chat';
import { ThemeProvider, useTheme } from '@/theme';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppStack />
    </ThemeProvider>
  );
}

function AppStack() {
  const { colors } = useTheme();
  return (
    <ChatProvider>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.brand,
          headerTitleStyle: { fontWeight: '700', color: colors.ink },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Onion Grader' }} />
        <Stack.Screen name="scan" options={{ headerShown: false }} />
        <Stack.Screen name="analyze" options={{ title: 'Grading', headerBackVisible: false }} />
        <Stack.Screen name="report/[id]" options={{ title: 'Quality report' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
      {/* Floating assistant, drawn above every screen except the camera and grading progress */}
      <ChatBubble />
    </ChatProvider>
  );
}
