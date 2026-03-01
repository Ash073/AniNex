import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StyleSheet,
  Platform,
  LayoutAnimation,
  UIManager,
  Dimensions,
} from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { postService } from '@/services/postService';
import { friendService } from '@/services/friendService';
import FriendsBottomSheet from '@/components/FriendsBottomSheet';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Post } from '@/types';
import UpdateNotesModal, { CURRENT_VERSION } from '@/components/UpdateNotesModal';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 2;
const GRID_COLS = 3;
const TILE_SIZE = (SCREEN_WIDTH - 32 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

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
  if (LOCAL_AVATARS[avatar]) return LOCAL_AVATARS[avatar];
  return null;
}


/** Instagram-style relative timestamp */
function formatPostTime(dateStr?: string | Date) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sameYear = d.getFullYear() === new Date().getFullYear();
  if (sameYear) return `${months[d.getMonth()]} ${d.getDate()}`;
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, clearAuth } = useAuthStore();
  const [showInterests, setShowInterests] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [showFriendsSheet, setShowFriendsSheet] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  // Fetch user's posts
  const userId = user?.id || user?._id || '';
  const { data: myPosts = [] } = useQuery({
    queryKey: ['user-posts', userId],
    queryFn: () => postService.getUserPosts(userId),
    enabled: !!userId,
  });

  // Fetch my friends list with full user objects (for friends bottom sheet)
  const { data: myFriends = [] } = useQuery({
    queryKey: ['friends-list'],
    queryFn: friendService.getFriends,
    enabled: !!userId,
  });

  const toggleInterests = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowInterests((p) => !p);
  };

  const hasAnyInterests =
    (user?.favoriteAnime?.length ?? 0) > 0 ||
    (user?.genres?.length ?? 0) > 0 ||
    (user?.interests?.length ?? 0) > 0;

  const handleLogout = () => {
    const doLogout = async () => {
      try {
        await authService.logout();
        await clearAuth();
        router.replace('/welcome');
      } catch (error) {
        console.error('Logout error:', error);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        doLogout();
      }
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, posts, messages, and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Type DELETE in your mind and tap confirm. All your data will be gone permanently.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await authService.deleteAccount();
                      await clearAuth();
                      router.replace('/welcome');
                    } catch (error: any) {
                      Alert.alert('Error', error.response?.data?.message || 'Failed to delete account');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  if (!user) return null;

  const avatarSrc = getAvatarSource(user.avatar);

  return (
    <>
      <View style={{ flex: 1, backgroundColor: '#0a0a14' }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: insets.top + 12 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Title row */}
          <View style={s.headerRow}>
            <Text style={s.pageTitle}>Profile</Text>
            <TouchableOpacity onPress={handleLogout} activeOpacity={0.7} style={s.logoutBtn}>
              <Ionicons name="log-out-outline" size={20} color="#ec4899" />
            </TouchableOpacity>
          </View>

          {/* Avatar + info card */}
          <View style={s.card}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              {avatarSrc && !avatarError ? (
                <Image
                  source={avatarSrc}
                  style={s.bigAvatar}
                  onError={() => setAvatarError(true)}
                  resizeMode="cover"
                  fadeDuration={0} // Disable fade animation on Android
                />
              ) : (
                <View style={[s.bigAvatar, { backgroundColor: 'rgba(99,102,241,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="person" size={40} color="rgba(99,102,241,0.6)" />
                </View>
              )}
              <Text style={s.username}>{user.displayName || user.username}</Text>
              {user.username && <Text style={s.email}>@{user.username}</Text>}
              {user.bio ? <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 }} numberOfLines={2}>{user.bio}</Text> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <View
                  style={[
                    s.statusDot,
                    { backgroundColor: user.isOnline ? '#22c55e' : '#6b7280' },
                  ]}
                />
                <Text style={s.muted}>{user.isOnline ? 'Online' : 'Offline'}</Text>
              </View>
            </View>

            {/* Stats rows */}
            <View style={s.statsRow}>
              <View style={s.stat}>
                <Text style={s.statNum}>{user.servers?.length ?? 0}</Text>
                <Text style={s.statLabel}>Servers</Text>
              </View>
              <TouchableOpacity
                style={s.stat}
                activeOpacity={0.7}
                onPress={() => setShowFriendsSheet(true)}
              >
                <Text style={s.statNum}>{user.friends?.length ?? 0}</Text>
                <Text style={s.statLabel}>Friends</Text>
              </TouchableOpacity>
              <View style={s.stat}>
                <Text style={s.statNum}>{myPosts.length}</Text>
                <Text style={s.statLabel}>Posts</Text>
              </View>
            </View>

            <View style={[s.statsRow, { borderTopWidth: 0, paddingTop: 10 }]}>
              <View style={s.stat}>
                <Text style={s.statNum}>{user.level || 1}</Text>
                <Text style={s.statLabel}>Level</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statNum}>{user.xp || 0}</Text>
                <Text style={s.statLabel}>XP</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statNum}>{user.streak || 0} 🔥</Text>
                <Text style={s.statLabel}>Streak</Text>
              </View>
            </View>
          </View>

          {/* ── Interests toggle button ── */}
          {hasAnyInterests && (
            <TouchableOpacity
              style={s.interestsToggle}
              activeOpacity={0.7}
              onPress={toggleInterests}
            >
              <View style={s.interestsToggleLeft}>
                <View style={s.interestsIcon}>
                  <Ionicons name="heart-circle" size={22} color="#818cf8" />
                </View>
                <Text style={s.interestsToggleText}>Interests & Favorites</Text>
              </View>
              <Ionicons
                name={showInterests ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="rgba(255,255,255,0.35)"
              />
            </TouchableOpacity>
          )}

          {/* Badges Section */}
          {user.badges && user.badges.length > 0 && (
            <View style={s.badgesSection}>
              <View style={s.sectionHeader}>
                <Ionicons name="ribbon-outline" size={20} color="#fbbf24" />
                <Text style={s.sectionTitle}>Your Badges</Text>
              </View>
              <View style={s.chipRow}>
                {user.badges.map((badge: string, index: number) => (
                  <View key={index} style={s.badgeChip}>
                    <Text style={s.badgeText}>{badge}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {showInterests && hasAnyInterests && (
            <View style={s.interestsPanel}>
              {/* Favorite Anime */}
              {user.favoriteAnime?.length > 0 && (
                <View style={s.interestSection}>
                  <View style={s.interestSectionHeader}>
                    <Ionicons name="tv-outline" size={16} color="#818cf8" />
                    <Text style={s.interestSectionTitle}>Favorite Anime</Text>
                  </View>
                  <View style={s.chipRow}>
                    {user.favoriteAnime.map((anime) => (
                      <View key={anime} style={s.chipPrimary}>
                        <Text style={s.chipPrimaryText}>{anime}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Genres */}
              {user.genres?.length > 0 && (
                <View style={s.interestSection}>
                  <View style={s.interestSectionHeader}>
                    <Ionicons name="musical-notes-outline" size={16} color="#f472b6" />
                    <Text style={[s.interestSectionTitle, { color: '#f472b6' }]}>Genres</Text>
                  </View>
                  <View style={s.chipRow}>
                    {user.genres.map((genre) => (
                      <View key={genre} style={s.chipAccent}>
                        <Text style={s.chipAccentText}>{genre}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Interests */}
              {user.interests?.length > 0 && (
                <View style={s.interestSection}>
                  <View style={s.interestSectionHeader}>
                    <Ionicons name="sparkles-outline" size={16} color="rgba(255,255,255,0.55)" />
                    <Text style={s.interestSectionTitle}>Interests</Text>
                  </View>
                  <View style={s.chipRow}>
                    {user.interests.map((interest) => (
                      <View key={interest} style={s.chipMuted}>
                        <Text style={s.chipMutedText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Edit / Update button */}
              <TouchableOpacity style={s.editInterestsBtn} activeOpacity={0.7} onPress={() => router.push('/(modals)/edit-profile' as any)}>
                <Ionicons name="pencil-outline" size={16} color="#818cf8" />
                <Text style={s.editInterestsBtnText}>Edit Interests</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Edit Profile button (always visible, below interests) ── */}
          <TouchableOpacity
            style={s.editProfileBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/(modals)/edit-profile' as any)}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={s.editProfileBtnText}>Edit Profile</Text>
          </TouchableOpacity>

          {/* ── My Posts Grid ── */}
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="grid" size={18} color="#818cf8" />
                <Text style={s.sectionTitle}>My Posts</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '600' }}>
                {myPosts.length} {myPosts.length === 1 ? 'post' : 'posts'}
              </Text>
            </View>

            {myPosts.length === 0 ? (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}>
                <Ionicons name="document-text-outline" size={40} color="rgba(255,255,255,0.12)" />
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600', marginTop: 10 }}>No posts yet</Text>
                <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 4 }}>Share your first post with the community!</Text>
                <TouchableOpacity
                  style={{ marginTop: 14, backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => router.push('/(modals)/create-post')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Create Post</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.gridContainer}>
                {myPosts.map((post: Post, index: number) => {
                  const hasImage = (post.images?.length ?? 0) > 0;
                  return (
                    <TouchableOpacity
                      key={post.id || post._id}
                      style={s.gridTile}
                      activeOpacity={0.8}
                      onPress={() => router.push(`/(modals)/post-viewer?userId=${userId}&startIndex=${index}` as any)}
                    >
                      {hasImage ? (
                        <Image
                          source={{ uri: post.images[0] }}
                          style={s.gridImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={s.gridTextTile}>
                          <Text style={s.gridTextContent} numberOfLines={4}>
                            {post.title || post.content}
                          </Text>
                        </View>
                      )}
                      {/* Overlay with stats */}
                      <View style={s.gridOverlay}>
                        <View style={s.gridStat}>
                          <Ionicons name="heart" size={12} color="#fff" />
                          <Text style={s.gridStatText}>{post.like_count ?? post.likeCount ?? 0}</Text>
                        </View>
                      </View>
                      {/* Multi-image indicator */}
                      {(post.images?.length ?? 0) > 1 && (
                        <View style={s.multiIndicator}>
                          <Ionicons name="copy" size={14} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Settings & Logout */}
          <View style={s.card}>
            <TouchableOpacity
              style={s.actionRow}
              activeOpacity={0.7}
              onPress={() => router.push('/(modals)/settings' as any)}
            >
              <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.6)" />
              <Text style={s.actionLabel}>Settings</Text>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.2)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionRow, s.actionBorder]}
              activeOpacity={0.7}
              onPress={() => setShowWhatsNew(true)}
            >
              <Ionicons name="sparkles-outline" size={22} color="#fbbf24" />
              <Text style={s.actionLabel}>What's New</Text>
              <View style={s.versionChip}>
                <Text style={s.versionChipText}>v{CURRENT_VERSION}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.2)" />
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionRow, s.actionBorder]} onPress={handleLogout} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={22} color="#ec4899" />
              <Text style={[s.actionLabel, { color: '#ec4899' }]}>Logout</Text>
              <Ionicons name="chevron-forward" size={20} color="#ec4899" />
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionRow, s.actionBorder]} onPress={handleDeleteAccount} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
              <Text style={[s.actionLabel, { color: '#ef4444' }]}>Delete Account</Text>
              <Ionicons name="chevron-forward" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
      <FriendsBottomSheet
        visible={showFriendsSheet}
        onClose={() => setShowFriendsSheet(false)}
        friends={myFriends}
        title={`${user.displayName || user.username || 'You'}'s Friends`}
      />
      <UpdateNotesModal
        visible={showWhatsNew}
        onClose={() => setShowWhatsNew(false)}
        permanent={false}
      />
    </>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#fff' },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(236,72,153,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any)
      : {}),
  },

  bigAvatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 12 },
  username: { fontSize: 22, fontWeight: '800', color: '#fff' },
  email: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  muted: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  bio: { color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 16, fontSize: 14, lineHeight: 20 },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  stat: { alignItems: 'center' },
  statNum: { color: '#fff', fontWeight: '800', fontSize: 18 },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },

  sectionTitle: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipPrimary: { backgroundColor: 'rgba(99,102,241,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  chipPrimaryText: { color: '#818cf8', fontWeight: '600', fontSize: 13 },
  chipAccent: { backgroundColor: 'rgba(236,72,153,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  chipAccentText: { color: '#f472b6', fontWeight: '600', fontSize: 13, textTransform: 'capitalize' },
  chipMuted: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  chipMutedText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13, textTransform: 'capitalize' },

  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  actionBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  actionLabel: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 15 },

  /* ── Interests toggle ── */
  interestsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  interestsToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  interestsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(99,102,241,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestsToggleText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  /* ── Interests panel ── */
  interestsPanel: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    marginTop: -8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any)
      : {}),
  },
  interestSection: { marginBottom: 16 },
  interestSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  interestSectionTitle: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },

  editInterestsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
    marginTop: 4,
  },
  editInterestsBtnText: { color: '#818cf8', fontWeight: '700', fontSize: 14 },

  /* ── Edit Profile button ── */
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  editProfileBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  /* ── Posts Grid ── */
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridTextTile: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
  gridTextContent: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    lineHeight: 15,
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  gridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gridStatText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  multiIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  /* ── My Posts ── */
  myPostCategoryBadge: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  myPostCategoryText: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  /* ── Version chip ── */
  versionChip: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.2)',
  },
  versionChipText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
  },
  /* ── Badges ── */
  badgesSection: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  badgeChip: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  badgeText: { color: '#fbbf24', fontWeight: '700', fontSize: 13 },
});