import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  Dimensions,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  Alert,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReportModal from '@/components/ReportModal';
import { userService } from '@/services/userService';
import { postService } from '@/services/postService';
import { friendService } from '@/services/friendService';
import { dmService } from '@/services/dmService';
import BlockUserModal from '@/components/BlockUserModal';
import FriendsBottomSheet from '@/components/FriendsBottomSheet';
import { useAuthStore } from '@/store/authStore';
import { safeGoBack } from '@/utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Post } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 2;
const GRID_COLS = 3;
const TILE_SIZE = (SCREEN_WIDTH - 32 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

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
  if (avatar.startsWith('local:')) return LOCAL_AVATARS[avatar.replace('local:', '')] ?? null;
  if (avatar.startsWith('gallery:')) {
    const uri = avatar.replace('gallery:', '');
    if (uri.startsWith('file') || uri.startsWith('/')) return null;
    return { uri };
  }
  if (avatar.startsWith('http')) return { uri: avatar };
  if (LOCAL_AVATARS[avatar]) return LOCAL_AVATARS[avatar];
  return null;
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const { user: me } = useAuthStore();
  const queryClient = useQueryClient();
  const [showInterests, setShowInterests] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showFriendsSheet, setShowFriendsSheet] = useState(false);

  const { data: profileUser, isLoading: userLoading } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => userService.getUserById(userId),
    enabled: !!userId,
  });

  const { data: userPosts = [] } = useQuery({
    queryKey: ['user-posts', userId],
    queryFn: () => postService.getUserPosts(userId),
    enabled: !!userId,
  });

  // Fetch user's friends
  const { data: userFriends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ['user-friends', userId],
    queryFn: () => userService.getUserFriends(userId),
    enabled: !!userId,
  });

  const { data: activeServers = [] } = useQuery({
    queryKey: ['user-servers', userId],
    queryFn: () => userService.getUserServers(userId),
    enabled: !!userId,
  });

  // Fetch my friends to determine mutual connections
  const { data: myFriends = [] } = useQuery({
    queryKey: ['friends-list'],
    queryFn: friendService.getFriends,
    enabled: !!me?.id,
  });

  const { data: sentRequests = [] } = useQuery({
    queryKey: ['friend-requests-sent'],
    queryFn: () => friendService.getSent(),
  });

  const sentToIds = new Set(sentRequests.map((r: any) => r.receiver_id));
  const myFriendIds = new Set(me?.friends || []);
  const isFriend = myFriendIds.has(userId);
  const isPending = sentToIds.has(userId);
  const isMe = userId === (me?.id || me?._id);

  const sendRequestMutation = useMutation({
    mutationFn: (id: string) => friendService.sendRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests-sent'] });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: (id: string) => userService.removeFriend(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests-sent'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['friends-list'] });
      // Refresh current user to update friends list
      try {
        const { useAuthStore } = require('@/store/authStore');
        const { authService } = require('@/services/authService');
        const freshUser = await authService.getCurrentUser();
        useAuthStore.getState().setUser(freshUser);
      } catch { }
    },
  });

  const handleRemoveFriend = () => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${profileUser?.display_name || profileUser?.username || 'this user'} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFriendMutation.mutate(userId),
        },
      ]
    );
  };

  const toggleInterests = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowInterests((p) => !p);
  };

  const handleStartChat = async () => {
    try {
      const convo = await dmService.startConversation(userId);
      router.push({
        pathname: '/(modals)/dm/[conversationId]',
        params: {
          conversationId: convo.id,
          name: profileUser?.display_name || profileUser?.username || 'User',
          avatar: profileUser?.avatar || '',
          recipientId: userId,
        },
      } as any);
    } catch (e) {
      console.error('Failed to start chat', e);
      Alert.alert('Error', 'Could not start conversation');
    }
  };

  if (userLoading) {
    return (
      <View style={[st.container, { paddingTop: insets.top }]}>
        <View style={[st.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => safeGoBack('/home')} style={st.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>Profile</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View style={[st.container, { paddingTop: insets.top }]}>
        <View style={[st.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => safeGoBack('/home')} style={st.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>Profile</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person-outline" size={48} color="rgba(255,255,255,0.2)" />
          <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 12, fontSize: 15 }}>User not found</Text>
        </View>
      </View>
    );
  }

  const u = profileUser;
  const avatarSrc = getAvatarSource(u.avatar);
  const favoriteAnime = u.favorite_anime || u.favoriteAnime || [];
  const genres = u.genres || [];
  const interests = u.interests || [];
  const hasAnyInterests = favoriteAnime.length > 0 || genres.length > 0 || interests.length > 0;

  return (
    <>
      <View style={st.container}>
        <View style={[st.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => safeGoBack('/home')} style={st.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>@{u.username}</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar + info card */}
          <View style={st.card}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              {avatarSrc ? (
                <Image
                  source={avatarSrc}
                  style={st.bigAvatar}
                  resizeMode="cover"
                  fadeDuration={0} // Disable fade animation on Android
                />
              ) : (
                <View style={[st.bigAvatar, { backgroundColor: 'rgba(99,102,241,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="person" size={36} color="rgba(255,255,255,0.5)" />
                </View>
              )}
              <Text style={st.username}>{u.display_name || u.displayName || u.username}</Text>
              <Text style={st.handle}>@{u.username}</Text>
              {u.bio ? <Text style={st.bio} numberOfLines={3}>{u.bio}</Text> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <View style={[st.statusDot, { backgroundColor: u.is_online ? '#22c55e' : '#6b7280' }]} />
                <Text style={st.muted}>{u.is_online ? 'Online' : 'Offline'}</Text>
              </View>
            </View>

            <View style={st.statsRow}>
              <View style={st.stat}>
                <Text style={st.statNum}>{activeServers.length}</Text>
                <Text style={st.statLabel}>Servers</Text>
              </View>
              <TouchableOpacity
                style={st.stat}
                onPress={() => setShowFriendsSheet(true)}
                activeOpacity={0.7}
              >
                <Text style={st.statNum}>{u.friends?.length ?? 0}</Text>
                <Text style={st.statLabel}>Friends</Text>
              </TouchableOpacity>
              <View style={st.stat}>
                <Text style={st.statNum}>{userPosts.length}</Text>
                <Text style={st.statLabel}>Posts</Text>
              </View>
            </View>

            <View style={[st.statsRow, { borderTopWidth: 0, paddingTop: 10 }]}>
              <View style={st.stat}>
                <Text style={st.statNum}>{u.level || 1}</Text>
                <Text style={st.statLabel}>Level</Text>
              </View>
              <View style={st.stat}>
                <Text style={st.statNum}>{u.xp || 0}</Text>
                <Text style={st.statLabel}>XP</Text>
              </View>
              <View style={st.stat}>
                <Text style={st.statNum}>{u.streak || 0} 🔥</Text>
                <Text style={st.statLabel}>Streak</Text>
              </View>
            </View>
          </View>

          {/* Friend action button */}
          {!isMe && (
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  {isFriend ? (
                    <View style={{ flex: 1, gap: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={[st.friendBadge, { flex: 1 }]}>
                          <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                          <Text style={{ color: '#22c55e', fontWeight: '700', fontSize: 14 }}>Friends</Text>
                        </View>
                        <TouchableOpacity
                          style={st.removeFriendBtn}
                          activeOpacity={0.7}
                          onPress={handleRemoveFriend}
                          disabled={removeFriendMutation.isPending}
                        >
                          {removeFriendMutation.isPending ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                          ) : (
                            <Ionicons name="person-remove" size={18} color="#ef4444" />
                          )}
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={st.messageBtn}
                        activeOpacity={0.7}
                        onPress={handleStartChat}
                      >
                        <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Message</Text>
                      </TouchableOpacity>
                    </View>
                  ) : isPending ? (
                    <View style={st.pendingBadge}>
                      <Ionicons name="time-outline" size={18} color="#f59e0b" />
                      <Text style={{ color: '#f59e0b', fontWeight: '700', fontSize: 14 }}>Request Sent</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={st.addFriendBtn}
                      activeOpacity={0.7}
                      onPress={() => sendRequestMutation.mutate(userId)}
                      disabled={sendRequestMutation.isPending}
                    >
                      {sendRequestMutation.isPending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="person-add" size={18} color="#fff" />
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Add Friend</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Report and Block Buttons - Only show for non-friends */}
                {!isFriend && !isMe && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={st.reportBtn}
                      activeOpacity={0.7}
                      onPress={() => setShowBlockModal(true)}
                    >
                      <Ionicons name="ban" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Interests */}
          {hasAnyInterests && (
            <TouchableOpacity
              style={st.interestsToggle}
              activeOpacity={0.7}
              onPress={toggleInterests}
            >
              <View style={st.interestsToggleLeft}>
                <View style={st.interestsIcon}>
                  <Ionicons name="heart-circle" size={22} color="#818cf8" />
                </View>
                <Text style={st.interestsToggleText}>Interests & Favorites</Text>
              </View>
              <Ionicons name={showInterests ? 'chevron-up' : 'chevron-down'} size={20} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          )}

          {showInterests && hasAnyInterests && (
            <View style={st.interestsPanel}>
              {favoriteAnime.length > 0 && (
                <View style={st.interestSection}>
                  <View style={st.interestSectionHeader}>
                    <Ionicons name="tv-outline" size={16} color="#818cf8" />
                    <Text style={st.interestSectionTitle}>Favorite Anime</Text>
                  </View>
                  <View style={st.chipRow}>
                    {favoriteAnime.map((a: string) => (
                      <View key={a} style={st.chipPrimary}><Text style={st.chipPrimaryText}>{a}</Text></View>
                    ))}
                  </View>
                </View>
              )}
              {genres.length > 0 && (
                <View style={st.interestSection}>
                  <View style={st.interestSectionHeader}>
                    <Ionicons name="musical-notes-outline" size={16} color="#f472b6" />
                    <Text style={[st.interestSectionTitle, { color: '#f472b6' }]}>Genres</Text>
                  </View>
                  <View style={st.chipRow}>
                    {genres.map((g: string) => (
                      <View key={g} style={st.chipAccent}><Text style={st.chipAccentText}>{g}</Text></View>
                    ))}
                  </View>
                </View>
              )}
              {interests.length > 0 && (
                <View style={st.interestSection}>
                  <View style={st.interestSectionHeader}>
                    <Ionicons name="sparkles-outline" size={16} color="rgba(255,255,255,0.55)" />
                    <Text style={st.interestSectionTitle}>Interests</Text>
                  </View>
                  <View style={st.chipRow}>
                    {interests.map((i: string) => (
                      <View key={i} style={st.chipMuted}><Text style={st.chipMutedText}>{i}</Text></View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Badges Section */}
          {u.badges && u.badges.length > 0 && (
            <View style={st.badgesSection}>
              <View style={st.sectionHeader}>
                <Ionicons name="ribbon-outline" size={20} color="#fbbf24" />
                <Text style={st.sectionTitle}>Unlocked Badges</Text>
              </View>
              <View style={st.chipRow}>
                {u.badges.map((badge: string, index: number) => (
                  <View key={index} style={st.badgeChip}>
                    <Text style={st.badgeText}>{badge}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Posts Grid */}
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="grid" size={18} color="#818cf8" />
                <Text style={st.sectionTitle}>Posts</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '600' }}>
                {userPosts.length} {userPosts.length === 1 ? 'post' : 'posts'}
              </Text>
            </View>

            {userPosts.length === 0 ? (
              <View style={[st.card, { alignItems: 'center', paddingVertical: 32 }]}>
                <Ionicons name="document-text-outline" size={40} color="rgba(255,255,255,0.12)" />
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600', marginTop: 10 }}>No posts yet</Text>
              </View>
            ) : (
              <View style={st.gridContainer}>
                {userPosts.map((post: Post, index: number) => {
                  const hasImage = (post.images?.length ?? 0) > 0;
                  return (
                    <TouchableOpacity
                      key={post.id || post._id}
                      style={st.gridTile}
                      activeOpacity={0.8}
                      onPress={() => router.push(`/(modals)/post-viewer?userId=${userId}&startIndex=${index}` as any)}
                    >
                      {hasImage ? (
                        <Image source={{ uri: post.images[0] }} style={st.gridImage} resizeMode="cover" />
                      ) : (
                        <View style={st.gridTextTile}>
                          <Text style={st.gridTextContent} numberOfLines={4}>{post.title || post.content}</Text>
                        </View>
                      )}
                      <View style={st.gridOverlay}>
                        <View style={st.gridStat}>
                          <Ionicons name="heart" size={12} color="#fff" />
                          <Text style={st.gridStatText}>{post.like_count ?? post.likeCount ?? 0}</Text>
                        </View>
                      </View>
                      {(post.images?.length ?? 0) > 1 && (
                        <View style={st.multiIndicator}>
                          <Ionicons name="copy" size={14} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

        </ScrollView>
      </View>
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="user"
        targetId={userId}
        targetName={profileUser?.display_name || profileUser?.username}
      />
      <BlockUserModal
        visible={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        targetUserId={userId}
        targetUsername={profileUser?.username || 'User'}
        targetAvatar={profileUser?.avatar}
        onBlockChange={(isBlocked) => {
          // Update UI or perform any actions needed after block status change
          console.log('Block status changed:', isBlocked);
        }}
      />
      <FriendsBottomSheet
        visible={showFriendsSheet}
        onClose={() => setShowFriendsSheet(false)}
        friends={userFriends}
        title={`${u.display_name || u.username}'s Friends`}
      />
    </>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bigAvatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 12 },
  username: { fontSize: 22, fontWeight: '800', color: '#fff' },
  handle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 2 },
  bio: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  muted: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },

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

  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 12,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  removeFriendBtn: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  reportBtn: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
  },

  sectionTitle: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 0 },

  /* ── Interests ── */
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(99,102,241,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  interestsToggleText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  interestsPanel: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16, padding: 16, marginBottom: 14, marginTop: -8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  interestSection: { marginBottom: 16 },
  interestSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  interestSectionTitle: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipPrimary: { backgroundColor: 'rgba(99,102,241,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  chipPrimaryText: { color: '#818cf8', fontWeight: '600', fontSize: 13 },
  chipAccent: { backgroundColor: 'rgba(236,72,153,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  chipAccentText: { color: '#f472b6', fontWeight: '600', fontSize: 13, textTransform: 'capitalize' },
  chipMuted: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  chipMutedText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 13, textTransform: 'capitalize' },

  /* ── Grid ── */
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
  gridImage: { width: '100%', height: '100%' },
  gridTextTile: {
    flex: 1, padding: 8, justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
  gridTextContent: { color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 15 },
  gridOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  gridStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gridStatText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  multiIndicator: { position: 'absolute', top: 6, right: 6 },
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
