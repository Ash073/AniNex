import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { recommendationService } from '@/services/recommendationService';
import { serverService } from '@/services/serverService';
import { friendService } from '@/services/friendService';
import { userService } from '@/services/userService';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Avatar helpers (same as profile)
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

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'users' | 'servers'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const queryClient = useQueryClient();
  const { user: currentUser, setUser } = useAuthStore();

  // Debounced search
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, 400);
    setSearchTimeout(timeout);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
  };

  // Search results
  const { data: searchedUsers = [], isLoading: searchUsersLoading } = useQuery({
    queryKey: ['search-users', debouncedQuery],
    queryFn: () => userService.searchUsers(debouncedQuery),
    enabled: activeTab === 'users' && debouncedQuery.length >= 2,
  });

  const { data: searchedServers = [], isLoading: searchServersLoading } = useQuery({
    queryKey: ['search-servers', debouncedQuery],
    queryFn: () => serverService.searchServers(debouncedQuery),
    enabled: activeTab === 'servers' && debouncedQuery.length >= 2,
  });

  const isSearching = debouncedQuery.length >= 2;

  // Helper to refresh current user from backend
  const refreshCurrentUser = async () => {
    try {
      const freshUser = await authService.getCurrentUser();
      setUser(freshUser);
    } catch (e) {
      console.error('Failed to refresh user:', e);
    }
  };

  const { data: recommendedUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['recommended-users'],
    queryFn: () => recommendationService.getRecommendedUsers(15),
  });

  const { data: recommendedServers = [], isLoading: serversLoading } = useQuery({
    queryKey: ['recommended-servers'],
    queryFn: () => recommendationService.getRecommendedServers(15),
  });

  // Pending requests I received
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['friend-requests-pending'],
    queryFn: () => friendService.getPending(),
  });

  // Requests I sent
  const { data: sentRequests = [] } = useQuery({
    queryKey: ['friend-requests-sent'],
    queryFn: () => friendService.getSent(),
  });

  // Derive lookup sets for fast checks
  const sentToIds = new Set(sentRequests.map((r: any) => r.receiver_id));
  const receivedFromIds = new Map(
    pendingRequests.map((r: any) => [r.sender_id, r.id])
  );
  const myFriendIds = new Set(currentUser?.friends || []);

  // ─── Mutations ───
  const sendRequestMutation = useMutation({
    mutationFn: (userId: string) => friendService.sendRequest(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests-sent'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests-pending'] });
      queryClient.invalidateQueries({ queryKey: ['recommended-users'] });
      refreshCurrentUser();
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: (requestId: string) => friendService.acceptRequest(requestId),
    onSuccess: async () => {
      await refreshCurrentUser();
      queryClient.invalidateQueries({ queryKey: ['friend-requests-pending'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests-sent'] });
      queryClient.invalidateQueries({ queryKey: ['recommended-users'] });
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: (userId: string) => friendService.cancelRequest(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests-sent'] });
      queryClient.invalidateQueries({ queryKey: ['recommended-users'] });
    },
  });

  const getRelationship = useCallback(
    (userId: string): 'friends' | 'pending_sent' | 'pending_received' | 'none' => {
      if (myFriendIds.has(userId)) return 'friends';
      if (sentToIds.has(userId)) return 'pending_sent';
      if (receivedFromIds.has(userId)) return 'pending_received';
      return 'none';
    },
    [myFriendIds, sentToIds, receivedFromIds]
  );

  const handleFriendAction = (userId: string) => {
    const rel = getRelationship(userId);
    if (rel === 'none') {
      sendRequestMutation.mutate(userId);
    } else if (rel === 'pending_sent') {
      cancelRequestMutation.mutate(userId);
    } else if (rel === 'pending_received') {
      const requestId = receivedFromIds.get(userId);
      if (requestId) acceptRequestMutation.mutate(requestId);
    }
  };

  const handleJoinServer = async (serverId: string) => {
    try {
      await serverService.joinServer(serverId);
      Alert.alert(
        'Request Sent!',
        'Your request to join has been sent. The admin will review it shortly.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send join request');
    }
  };

  const renderFriendButton = (userId: string) => {
    const rel = getRelationship(userId);
    const isLoading =
      sendRequestMutation.isPending ||
      acceptRequestMutation.isPending ||
      cancelRequestMutation.isPending;

    switch (rel) {
      case 'friends':
        return (
          <View style={s.friendBtnDone}>
            <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
            <Text style={[s.friendBtnText, { color: '#22c55e' }]}>Friends</Text>
          </View>
        );
      case 'pending_sent':
        return (
          <TouchableOpacity
            style={s.friendBtnPending}
            onPress={() => handleFriendAction(userId)}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <Ionicons name="time-outline" size={15} color="#f59e0b" />
            <Text style={[s.friendBtnText, { color: '#f59e0b' }]}>Pending</Text>
          </TouchableOpacity>
        );
      case 'pending_received':
        return (
          <TouchableOpacity
            style={s.friendBtnAccept}
            onPress={() => handleFriendAction(userId)}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <Ionicons name="person-add" size={15} color="#fff" />
            <Text style={s.friendBtnText}>Accept</Text>
          </TouchableOpacity>
        );
      default:
        return (
          <TouchableOpacity
            style={s.friendBtnAdd}
            onPress={() => handleFriendAction(userId)}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={15} color="#fff" />
                <Text style={s.friendBtnText}>Add</Text>
              </>
            )}
          </TouchableOpacity>
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a14' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: insets.top + 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={s.title}>Discover</Text>

        {/* Segmented tab */}
        <View style={s.segmented}>
          <TouchableOpacity
            onPress={() => setActiveTab('users')}
            style={[s.segBtn, activeTab === 'users' && s.segBtnActive]}
            activeOpacity={0.7}
          >
            <Text style={[s.segText, activeTab === 'users' && s.segTextActive]}>People</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('servers')}
            style={[s.segBtn, activeTab === 'servers' && s.segBtnActive]}
            activeOpacity={0.7}
          >
            <Text style={[s.segText, activeTab === 'servers' && s.segTextActive]}>Servers</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={s.searchBar}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.35)" />
          <TextInput
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder={activeTab === 'users' ? 'Search people by username...' : 'Search servers by name...'}
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={s.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Users */}
        {activeTab === 'users' && (
          <View>
            {/* Pending Friend Requests Banner (only when not searching) */}
            {!isSearching && pendingRequests.length > 0 && (
              <View style={s.pendingBanner}>
                <View style={s.pendingBannerLeft}>
                  <Ionicons name="people" size={20} color="#f59e0b" />
                  <Text style={s.pendingBannerText}>
                    {pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                  {pendingRequests.map((req: any) => {
                    const senderAvatarSrc = getAvatarSource(req.sender?.avatar);
                    return (
                    <View key={req.id} style={s.pendingCard}>
                      {senderAvatarSrc ? (
                        <Image source={senderAvatarSrc} style={s.pendingAvatar} />
                      ) : (
                        <View style={[s.pendingAvatar, { backgroundColor: 'rgba(99,102,241,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="person" size={20} color="rgba(255,255,255,0.5)" />
                        </View>
                      )}
                      <Text style={s.pendingName} numberOfLines={1}>
                        {req.sender?.display_name || req.sender?.username || 'User'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={s.pendingAcceptBtn}
                          onPress={() => acceptRequestMutation.mutate(req.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.pendingRejectBtn}
                          onPress={() => friendService.rejectRequest(req.id).then(() => {
                            queryClient.invalidateQueries({ queryKey: ['friend-requests-pending'] });
                          })}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close" size={16} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                  })}
                </ScrollView>
              </View>
            )}

            <Text style={s.sectionTitle}>{isSearching ? `Results for "${debouncedQuery}"` : 'People You Might Like'}</Text>

            {(isSearching ? searchUsersLoading : usersLoading) ? (
              <View style={{ alignItems: 'center', paddingTop: 30 }}>
                <ActivityIndicator color="#6366f1" />
                <Text style={[s.muted, { marginTop: 8 }]}>{isSearching ? 'Searching…' : 'Loading…'}</Text>
              </View>
            ) : (isSearching ? searchedUsers : recommendedUsers).length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="people-outline" size={56} color="rgba(255,255,255,0.15)" />
                <Text style={s.emptyText}>
                  {isSearching
                    ? `No users found matching "${debouncedQuery}"`
                    : 'No recommendations yet. Complete your profile to get better matches!'}
                </Text>
              </View>
            ) : (
              (isSearching ? searchedUsers : recommendedUsers).map((user: any) => {
                const userId = user._id || user.id;
                const avatarSrc = getAvatarSource(user.avatar);
                return (
                  <View key={userId} style={s.userCard}>
                    {avatarSrc ? (
                      <Image 
                        source={avatarSrc} 
                        style={s.userAvatar} 
                        resizeMode="cover"
                        fadeDuration={0} // Disable fade animation on Android
                      />
                    ) : (
                      <View style={[s.userAvatar, { backgroundColor: 'rgba(99,102,241,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="person" size={24} color="rgba(255,255,255,0.5)" />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.userName}>{user.display_name || user.displayName || user.username}</Text>
                        <View
                          style={[s.onlineDot, { backgroundColor: (user.is_online || user.isOnline) ? '#22c55e' : '#6b7280' }]}
                        />
                      </View>
                      {(user.bio) ? (
                        <Text style={s.userBio} numberOfLines={2}>{user.bio}</Text>
                      ) : null}
                      {(user.favorite_anime || user.favoriteAnime)?.length > 0 && (
                        <View style={s.chipRow}>
                          {(user.favorite_anime || user.favoriteAnime).slice(0, 3).map((anime: string) => (
                            <View key={anime} style={s.chip}>
                              <Text style={s.chipText}>{anime}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    {renderFriendButton(userId)}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Servers */}
        {activeTab === 'servers' && (
          <View>
            <Text style={s.sectionTitle}>{isSearching ? `Results for "${debouncedQuery}"` : 'Servers You Might Like'}</Text>

            {(isSearching ? searchServersLoading : serversLoading) ? (
              <View style={{ alignItems: 'center', paddingTop: 30 }}>
                <ActivityIndicator color="#6366f1" />
                <Text style={[s.muted, { marginTop: 8 }]}>{isSearching ? 'Searching…' : 'Loading…'}</Text>
              </View>
            ) : (isSearching ? searchedServers : recommendedServers).length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="server-outline" size={56} color="rgba(255,255,255,0.15)" />
                <Text style={s.emptyText}>
                  {isSearching
                    ? `No servers found matching "${debouncedQuery}"`
                    : 'No recommendations yet. Join more servers to get better matches!'}
                </Text>
              </View>
            ) : (
              (isSearching ? searchedServers : recommendedServers).map((server: any) => {
                const iconUri = server.icon;
                const hasIcon = !!iconUri && !iconUri.includes('dicebear');
                return (
                  <TouchableOpacity
                    key={server._id || server.id}
                    style={s.serverCard}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/(modals)/server/${server._id || server.id}` as any)}
                  >
                    {/* Blurred background */}
                    {hasIcon ? (
                      <Image
                        source={{ uri: iconUri }}
                        style={s.serverBgImage}
                        blurRadius={Platform.OS === 'ios' ? 30 : 18}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[s.serverBgImage, { backgroundColor: '#1e1b4b' }]} />
                    )}
                    <View style={s.serverCardOverlay} />

                    <View style={s.serverCardContent}>
                      {/* Top row: icon + name */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        {hasIcon ? (
                          <Image source={{ uri: iconUri }} style={s.serverSharpIcon} />
                        ) : (
                          <View style={[s.serverSharpIcon, { backgroundColor: 'rgba(99,102,241,0.2)', alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="server" size={20} color="#818cf8" />
                          </View>
                        )}
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={s.userName} numberOfLines={1}>{server.name}</Text>
                          <Text style={s.userBio} numberOfLines={2}>{server.description || 'No description'}</Text>
                        </View>
                      </View>

                      {server.animeTheme && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                          <Ionicons name="star" size={14} color="#ec4899" />
                          <Text style={{ color: '#f472b6', fontWeight: '600', fontSize: 13 }}>{server.animeTheme}</Text>
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', gap: 14 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="people" size={15} color="rgba(255,255,255,0.55)" />
                            <Text style={s.muted}>{server.memberCount}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="chatbubbles" size={15} color="rgba(255,255,255,0.55)" />
                            <Text style={s.muted}>{server.messageCount}</Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={s.joinBtn}
                          onPress={() => handleJoinServer(server._id || server.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={s.joinText}>Request Join</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 16 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  segBtnActive: { backgroundColor: '#6366f1' },
  segText: { color: 'rgba(255,255,255,0.45)', fontWeight: '600', fontSize: 14 },
  segTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 12 },

  /* Search bar */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    padding: 0,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any)
      : {}),
  },
  userCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any)
      : {}),
  },

  userAvatar: { width: 52, height: 52, borderRadius: 26 },
  userName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  userBio: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { backgroundColor: 'rgba(99,102,241,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  chipText: { color: '#818cf8', fontSize: 11, fontWeight: '600' },

  serverIcon: { width: 50, height: 50, borderRadius: 14 },

  /* Blurred-background server card */
  serverCard: {
    borderRadius: 18,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    minHeight: 130,
  },
  serverBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  serverCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 20, 0.72)',
  },
  serverCardContent: {
    padding: 16,
    zIndex: 1,
  },
  serverSharpIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  joinBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
  },
  joinText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // ─── Friend Buttons ───
  friendBtnAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  friendBtnPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  friendBtnAccept: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  friendBtnDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
  },
  friendBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // ─── Pending Requests Banner ───
  pendingBanner: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.18)',
  },
  pendingBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingBannerText: {
    color: '#f59e0b',
    fontWeight: '700',
    fontSize: 14,
  },
  pendingCard: {
    alignItems: 'center',
    marginRight: 14,
    width: 80,
  },
  pendingAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 6,
  },
  pendingName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  pendingAcceptBtn: {
    backgroundColor: '#22c55e',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingRejectBtn: {
    backgroundColor: 'rgba(239,68,68,0.7)',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  muted: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 12, fontSize: 14, maxWidth: 260 },
});