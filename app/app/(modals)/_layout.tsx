import { Stack } from 'expo-router';
import GlobalBackground from '@/components/GlobalBackground';

export default function ModalsLayout() {
  return (
    <GlobalBackground>
      <Stack
        screenOptions={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }}
      >
        <Stack.Screen name="server/[id]" />
        <Stack.Screen name="chat/[channelId]" />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="create-server" />
        <Stack.Screen name="create-post" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="dm/[conversationId]" />
        <Stack.Screen name="post-viewer" />
        <Stack.Screen name="user-profile" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
      </Stack>
    </GlobalBackground>
  );
}