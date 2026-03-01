import { useEffect } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { View, ActivityIndicator, Text, Platform } from 'react-native';
import { useAuthStore } from '@/store/authStore';

export default function AuthLayout() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user?.onboardingCompleted && user?.profileCompleted) {
      if (pathname !== '/home') {
        console.log('User fully set up, redirecting to home');
        router.replace('/(tabs)/home');
      }
    } else if (isAuthenticated && user?.onboardingCompleted && !user?.profileCompleted) {
      if (pathname !== '/(auth)/profile-setup') {
        console.log('User onboarded but profile not set up, redirecting to profile-setup');
        router.replace('/(auth)/profile-setup');
      }
    } else if (isAuthenticated && !user?.onboardingCompleted) {
      if (pathname !== '/(auth)/onboarding') {
        console.log('User authenticated but not onboarded, redirecting to onboarding');
        router.replace('/(auth)/onboarding');
      }
    }
  }, [isAuthenticated, isLoading, user?.onboardingCompleted, user?.profileCompleted, pathname]);

  if (isLoading) {
    console.log('Showing loading spinner');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1e' }}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={{ color: '#fff', marginTop: 12 }}>Loading...</Text>
      </View>
    );
  }

  console.log('AuthLayout showing stack navigator');

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="welcome"
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="oauth-callback" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="add-friends" />
    </Stack>
  );
}
