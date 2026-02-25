import { useEffect, useState } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { NotificationProvider } from '@/components/NotificationProvider';
import Loader from '@/components/Loader';
import { useEffect as usePushEffect } from 'react';
import { registerForPushNotificationsAsync } from '@/utils/pushNotifications';

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
  const [pushToken, setPushToken] = useState<string | null>(null); // For push notifications

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

  usePushEffect(() => {
    async function setupPush() {
      const token = await registerForPushNotificationsAsync();
      if (token) setPushToken(token);
      // Optionally send token to backend
      if (token && user?.id) {
        // TODO: Uncomment and implement API call to store token
        // await api.post('/users/push-token', { userId: user.id, token });
      }
    }
    setupPush();
  }, [user]);

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