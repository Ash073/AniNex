import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useSocket } from '@/hooks/useSocket';
import { useEffect } from 'react';
import GlobalBackground from './GlobalBackground';

export default function AuthenticatedAppWrapper() {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  
  // Initialize socket connection
  useSocket();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !user?.onboardingCompleted) {
    return null; // Let the auth flow handle redirects
  }

  return (
    <GlobalBackground>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1a1a2e',
            borderTopColor: '#25253d',
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#6366f1',
          tabBarInactiveTintColor: '#6b6b70',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="servers"
          options={{
            title: 'Servers',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="server" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="compass" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </GlobalBackground>
  );
}