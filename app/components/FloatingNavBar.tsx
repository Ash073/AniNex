import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

// Local avatar map keyed by the ID used in profile-setup
const LOCAL_AVATARS: Record<string, any> = {
  '1': require('@/assets/avatar/Avatar1.png.jpeg'),
  '2': require('@/assets/avatar/Avatar2.png.jpeg'),
  '3': require('@/assets/avatar/Avatar3.png.jpeg'),
  '4': require('@/assets/avatar/Avatar4.png.jpeg'),
  '5': require('@/assets/avatar/Avatar5.png.jpeg'),
  '6': require('@/assets/avatar/Avatar6.png.jpeg'),
  '7': require('@/assets/avatar/Avatar7.png.jpeg'),
  '8': require('@/assets/avatar/Avatar8.png.jpeg'),
  'r1': require('@/assets/avatar/Avatarr1.png'),
  'r2': require('@/assets/avatar/Avatarr2.png'),
  'r3': require('@/assets/avatar/Avatarr3.png'),
  'r4': require('@/assets/avatar/Avatarr4.png'),
  'r5': require('@/assets/avatar/Avatarr5.png'),
  'r6': require('@/assets/avatar/Avatarr6.png'),
  'r7': require('@/assets/avatar/Avatarr7.png'),
  'r8': require('@/assets/avatar/Avatarr8.png'),
  'r9': require('@/assets/avatar/Avatarr9.png'),
  'r10': require('@/assets/avatar/Avatarr10.png'),
};

/**
 * Avatar field stored as "local:<id>" or "gallery:<uri>" or a plain URL.
 */
function getAvatarSource(avatar?: string) {
  if (!avatar) return null;
  if (avatar.startsWith('local:')) {
    const id = avatar.replace('local:', '');
    return LOCAL_AVATARS[id] ?? LOCAL_AVATARS['1'];
  }
  if (avatar.startsWith('gallery:')) {
    const uri = avatar.replace('gallery:', '');
    if (uri.startsWith('file') || uri.startsWith('/')) return null;
    return { uri };
  }
  if (avatar.startsWith('http')) return { uri: avatar };
  // Fallback: treat as local ID
  if (LOCAL_AVATARS[avatar]) return LOCAL_AVATARS[avatar];
  return null;
}

interface FloatingNavBarProps {
  activeTab: string;
  onTabPress: (tab: string) => void;
}

export default function FloatingNavBar({ activeTab, onTabPress }: FloatingNavBarProps) {
  const { user } = useAuthStore();
  const avatarSrc = getAvatarSource(user?.avatar);

  // We intentionally do NOT track avatarError here.
  // If the image fails to load, the fallback placeholder shows for that render,
  // but next time the component re-renders, the image gets another chance.
  // This prevents the avatar from permanently vanishing after a transient error.

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.pill}>
        {/* Home */}
        <TouchableOpacity
          onPress={() => onTabPress('home')}
          style={styles.tabButton}
          activeOpacity={0.7}
        >
          <View style={[
            styles.iconWrap,
            activeTab === 'home' && styles.iconWrapActive,
          ]}>
            <Ionicons
              name={activeTab === 'home' ? 'home' : 'home-outline'}
              size={24}
              color={activeTab === 'home' ? '#6366f1' : 'rgba(255,255,255,0.5)'}
            />
          </View>
        </TouchableOpacity>

        {/* Discover */}
        <TouchableOpacity
          onPress={() => onTabPress('discover')}
          style={styles.tabButton}
          activeOpacity={0.7}
        >
          <View style={[
            styles.iconWrap,
            activeTab === 'discover' && styles.iconWrapActive,
          ]}>
            <Ionicons
              name={activeTab === 'discover' ? 'compass' : 'compass-outline'}
              size={28}
              color={activeTab === 'discover' ? '#6366f1' : 'rgba(255,255,255,0.5)'}
            />
          </View>
        </TouchableOpacity>

        {/* Profile (avatar) */}
        <TouchableOpacity
          onPress={() => onTabPress('profile')}
          style={styles.tabButton}
          activeOpacity={0.7}
        >
          <View style={[
            styles.avatarWrap,
            activeTab === 'profile' && styles.avatarWrapActive,
          ]}>
            {avatarSrc ? (
              <Image
                key={`avatar-${user?.id || 'default'}`} // Better key to force re-render
                source={avatarSrc}
                style={styles.avatar}
                resizeMode="cover"
                fadeDuration={0} // Disable fade animation on Android
              />
            ) : (
              <Ionicons
                name="person"
                size={20}
                color={activeTab === 'profile' ? '#6366f1' : 'rgba(255,255,255,0.5)'}
              />
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 24 : 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: 280,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(20, 20, 35, 0.85)',
    // Glow / shadow
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    // Border
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as any
      : {}),
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden', // Prevent square highlights
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    transform: [{ scale: 1.12 }],
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  avatarWrapActive: {
    borderWidth: 2,
    borderColor: '#6366f1',
    transform: [{ scale: 1.12 }],
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});