import { useEffect, useRef } from 'react';
import { Stack, SplashScreen, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { NotificationProvider } from '@/components/NotificationProvider';
import Loader from '@/components/Loader';
import {
  registerForPushNotificationsAsync,
  addNotificationListener,
  addNotificationResponseListener,
} from '@/utils/pushNotifications';
import api from '@/services/api';

import {
  useFonts,
  Oswald_400Regular,
  Oswald_500Medium,
  Oswald_600SemiBold,
  Oswald_700Bold
} from '@expo-google-fonts/oswald';

const queryClient = new QueryClient();

// Keep the splash screen visible while loading auth
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { loadAuth, isLoading: isAuthLoading, user } = useAuthStore();
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  const [fontsLoaded] = useFonts({
    Oswald_400Regular,
    Oswald_500Medium,
    Oswald_600SemiBold,
    Oswald_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      loadAuth().finally(() => {
        SplashScreen.hideAsync();
      });
    }
  }, [loadAuth, fontsLoaded]);

  // Push notification setup — runs when user is logged in
  useEffect(() => {
    if (!user?.id) return;

    // Register for push notifications and send token to backend
    async function setupPushNotifications() {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          console.log('Registering push token with backend:', token);
          await api.post('/users/push-token', { token }).catch((err: any) => {
            console.error('Failed to register push token with backend:', err?.message);
          });
        }
      } catch (error) {
        console.error('Push notification setup error:', error);
      }
    }

    setupPushNotifications();

    // Handle notifications received while app is foregrounded
    notificationListener.current = addNotificationListener((notification) => {
      console.log('Notification received in foreground:', notification.request.content.title);
    });

    // Handle notification taps (user tapped on notification)
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped, data:', data);

      // Navigate based on notification type
      if (data?.type === 'dm' && data?.conversationId) {
        router.push({
          pathname: '/(modals)/dm/[conversationId]',
          params: {
            conversationId: data.conversationId as string,
            name: (data.senderName as string) || 'User',
            avatar: (data.senderAvatar as string) || '',
          },
        } as any);
      } else if (data?.type === 'server_message' && data?.channelId) {
        router.push({
          pathname: '/(modals)/chat/[channelId]',
          params: {
            channelId: data.channelId as string,
            channelName: (data.channelName as string) || 'general',
            serverName: (data.serverName as string) || 'Server',
          },
        } as any);
      } else if (data?.type === 'friend_request') {
        router.push('/(modals)/notifications' as any);
      } else if (data?.type === 'anime_fact') {
        // Tapping a fact takes them to the home feed
        router.push('/(tabs)/home');
      } else if (data?.type === 'friend_online' && data?.friend_id) {
        // Tapping "friend is online" takes them to that user's profile
        router.push(`/(modals)/user-profile?userId=${data.friend_id}` as any);
      } else if (data?.type === 'mention' && data?.channelId) {
        // Tapping a mention takes them to the channel
        router.push({
          pathname: '/(modals)/chat/[channelId]',
          params: { channelId: data.channelId as string },
        } as any);
      } else if (data?.type === 'post_like' || data?.type === 'post_comment') {
        // Tapping post interactions takes them to the post
        if (data?.post_id) router.push(`/(modals)/post/${data.post_id}`);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user?.id]);

  if (!fontsLoaded || isAuthLoading) {
    return <Loader />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(modals)" />
        </Stack>
      </NotificationProvider>
    </QueryClientProvider>
  );
}