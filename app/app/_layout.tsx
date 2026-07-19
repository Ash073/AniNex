import '../global.css';
import { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { NotificationProvider } from '@/components/NotificationProvider';
import Loader from '@/components/Loader';
import { UpdateChecker } from '@/components/UpdateChecker';
import { useNotifications } from '@/hooks/useNotifications';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { syncManager } from '@/utils/syncManager';

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

function NotificationSetup() {
  useNotifications();
  useOnlineStatus();
  
  useEffect(() => {
    syncManager.setupListeners();
  }, []);
  
  return null;
}

export default function RootLayout() {
  const { loadAuth, isLoading: isAuthLoading } = useAuthStore();

  const [fontsLoaded, fontError] = useFonts({
    Oswald_400Regular,
    Oswald_500Medium,
    Oswald_600SemiBold,
    Oswald_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      loadAuth();
    }
  }, [loadAuth, fontsLoaded, fontError]);

  if ((!fontsLoaded && !fontError) || isAuthLoading) {
    return <Loader />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <NotificationSetup />
        <UpdateChecker />
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
