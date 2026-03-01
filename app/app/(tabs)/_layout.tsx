import { useState, useEffect, useRef } from 'react';
import { Tabs, Redirect, usePathname, router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useSocket } from '@/hooks/useSocket';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FloatingNavBar from '@/components/FloatingNavBar';
import UpdateNotesModal, { shouldShowUpdateNotes } from '@/components/UpdateNotesModal';

// Opaque dark background for each tab scene – prevents overlap
const SCENE_BG = '#0a0a14';

export default function TabsLayout() {
  const { isAuthenticated, user, isLoading, hasCheckedUpdateNotes, setHasCheckedUpdateNotes } = useAuthStore();
  const pathname = usePathname();

  // Initialize socket connection
  useSocket();

  // Update notes modal visibility
  const [showUpdateNotes, setShowUpdateNotes] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.onboardingCompleted && !hasCheckedUpdateNotes) {
      setHasCheckedUpdateNotes(true);
      // Check if we should show the update notes
      shouldShowUpdateNotes().then((shouldShow) => {
        if (shouldShow) {
          // Small delay so the app loads smoothly first
          setTimeout(() => setShowUpdateNotes(true), 800);
        }
      });
    }
  }, [isAuthenticated, user?.onboardingCompleted, hasCheckedUpdateNotes]);

  if (isLoading) return null;

  if (!isAuthenticated || !user?.onboardingCompleted) {
    return <Redirect href="/welcome" />;
  }

  // Derive active tab from current path
  const activeTab = pathname.includes('discover')
    ? 'discover'
    : pathname.includes('profile')
      ? 'profile'
      : 'home';

  const handleTabPress = (tab: string) => {
    router.navigate(`/(tabs)/${tab}` as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: SCENE_BG }}>
      {/* Subtle ambient gradient behind everything */}
      <LinearGradient
        colors={['#0a0a14', '#0f1029', '#0a0a14']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Tabs – opaque sceneContainer so tabs don't bleed through each other */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          // Add Android-specific optimizations
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="discover" />
        <Tabs.Screen name="profile" />
        {/* Hide servers from tab bar; accessible via top-right button */}
        <Tabs.Screen name="servers" options={{ href: null }} />
      </Tabs>

      {/* Custom floating nav */}
      <FloatingNavBar activeTab={activeTab} onTabPress={handleTabPress} />

      {/* Update notes modal – auto-shown once after this version is deployed */}
      <UpdateNotesModal
        visible={showUpdateNotes}
        onClose={() => setShowUpdateNotes(false)}
        permanent={true}
      />
    </View>
  );
}