import { useEffect } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

// Normalize snake_case user from backend into camelCase for the frontend
const normalizeUser = (raw: any) => ({
  ...raw,
  id: raw.id || raw._id,
  _id: raw.id || raw._id,
  displayName: raw.display_name || raw.displayName || '',
  favoriteAnime: raw.favorite_anime || raw.favoriteAnime || [],
  experienceLevel: raw.experience_level || raw.experienceLevel || 'casual',
  onboardingCompleted: raw.onboarding_completed ?? raw.onboardingCompleted ?? false,
  profileCompleted: raw.profile_completed ?? raw.profileCompleted ?? false,
  isOnline: raw.is_online ?? raw.isOnline ?? false,
  lastSeen: raw.last_seen || raw.lastSeen,
  dateOfBirth: raw.date_of_birth || raw.dateOfBirth,
  createdAt: raw.created_at || raw.createdAt,
  updatedAt: raw.updated_at || raw.updatedAt,
});

export default function OAuthCallbackScreen() {
  const { setUser, setTokens } = useAuthStore();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // This page is only for web OAuth redirects
      router.replace('/welcome');
      return;
    }

    // Backend redirects here with ?token=…&refreshToken=…&user=…
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const userRaw = params.get('user');

    // Clean URL so tokens aren't visible in address bar
    window.history.replaceState(null, '', window.location.pathname);

    if (!token || !refreshToken || !userRaw) {
      router.replace('/welcome');
      return;
    }

    (async () => {
      try {
        const user = normalizeUser(JSON.parse(decodeURIComponent(userRaw)));
        setUser(user);
        await setTokens(token, refreshToken);
        router.replace(user.onboardingCompleted ? '/home' : '/onboarding');
      } catch (error: any) {
        console.error('OAuth callback error:', error);
        if (Platform.OS === 'web') {
          window.alert('Sign-in failed. Please try again.');
        }
        router.replace('/welcome');
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1e' }}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={{ color: '#fff', marginTop: 16, fontSize: 16 }}>Completing sign-in...</Text>
    </View>
  );
}
