import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  RefreshControl,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dmService } from '@/services/dmService';
import { friendService } from '@/services/friendService';
import { blockService } from '@/services/blockService';
import { serverService } from '@/services/serverService';
import { useAuthStore } from '@/store/authStore';
import { Conversation, Server } from '@/types';
import { safeGoBack } from '@/utils/navigation';

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
    // Reject stale file:// cache paths — only allow uploaded http(s) URLs
    if (uri.startsWith('file') || uri.startsWith('/')) return null;
    return { uri };
  }
  if (avatar.startsWith('http')) return { uri: avatar };
  if (LOCAL_AVATARS[avatar]) return LOCAL_AVATARS[avatar];
  return null;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const userId = user?.id || (user as any)?._id;
  const [activeTab, setActiveTab] = useState<'messages' | 'servers'>('messages');
  const [refreshing, setRefreshing] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [showServerGate, setShowServerGate] = useState(false);
  const [serverSearch, setServerSearch] = useState('');

  // ─── DM data ───
  const { data: conversations = [], refetch: refetchConvos } = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: dmService.getConversations,
  });

  // Fetch block status for all conversation participants
  const { data: blockedUsers = [], refetch: refetchBlocks } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: blockService.getBlockedUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Enhance conversations with block status
  const enhancedConversations = useMemo(() => {
    const blockedUserIds = new Set(blockedUsers.map(block => block.blocked_user.id));
    return conversations.map(conv => ({
      ...conv,
      isBlocked: conv.otherUser ? blockedUserIds.has(conv.otherUser.id) : false
    }));
  }, [conversations, blockedUsers]);

  const { data: friends = [], isLoading: loadingFriends, refetch: refetchFriends } = useQuery({
    queryKey: ['friends-list'],
    queryFn: friendService.getFriends,
  });

  // ─── Servers data ───
  const { data: servers = [], isLoading: loadingServers, refetch: refetchServers } = useQuery({
    queryKey: ['servers'],
    queryFn: serverService.getServers,
  });

  const myServers = servers.filter((sv: Server) => {
    if ((sv as any).is_member) return true;
    if (sv.members && Array.isArray(sv.members)) {
      return sv.members.some((m: any) => {
        const mUserId = typeof m.user === 'string' ? m.user : (m.user?.id || m.user?._id);
        return mUserId === userId;
      });
    }
    const ownerId = typeof sv.owner === 'string' ? sv.owner : ((sv.owner as any)?.id || (sv.owner as any)?._id || sv.owner_id);
    return ownerId === userId;
  });

  const publicServers = servers.filter((sv: Server) => {
    const sId = sv.id || sv._id;
    const isPublic = (sv as any).isPublic ?? (sv as any).is_public;
    return isPublic && !myServers.some(ms => (ms.id || ms._id) === sId);
  });

  // Filter servers by search
  const filterServersBySearch = (list: Server[]) => {
    if (!serverSearch.trim()) return list;
    const q = serverSearch.trim().toLowerCase();
    return list.filter(sv =>
      sv.name.toLowerCase().includes(q) ||
      (sv.description || '').toLowerCase().includes(q) ||
      ((sv as any).animeTheme || (sv as any).anime_theme || '').toLowerCase().includes(q) ||
      ((sv as any).tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
  };

  const filteredMyServers = filterServersBySearch(myServers);
  const filteredPublicServers = filterServersBySearch(publicServers);

  // ─── Handlers ───
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchConvos(), refetchFriends(), refetchServers()]);
    setRefreshing(false);
  }, [refetchConvos, refetchFriends, refetchServers]);

  const openFriendPicker = () => setShowFriendPicker(true);

  const handleCreateServer = () => {
    if (friends.length < 2) {
      setShowServerGate(true);
    } else {
      router.push('/(modals)/create-server');
    }
  };

  const startDmWith = async (friendId: string) => {
    setStartingChat(friendId);
    try {
      const convo = await dmService.startConversation(friendId);
      setShowFriendPicker(false);
      const friend = friends.find((f: any) => (f.id || f._id) === friendId);
      router.push({
        pathname: '/(modals)/dm/[conversationId]',
        params: {
          conversationId: convo.id,
          name: friend?.display_name || friend?.username || 'User',
          avatar: friend?.avatar || '',
          recipientId: friendId,
        },
      } as any);
      refetchConvos();
    } catch (e: any) {
      console.error('Failed to start conversation', e);
    } finally {
      setStartingChat(null);
    }
  };

  const getPreviewText = (item: Conversation) => {
    if (item.isBlocked) return 'Messaging unavailable';
    if (!item.last_message_text) return 'No messages yet';

    const text = item.last_message_text;

    // Post share
    const postMatch = text.match(/📝\s*Shared\s*Post\s*by\s*(.*?)(?:\n|$)/i);
    if (postMatch) {
      const author = postMatch[1].trim();
      return `Shared a post from ${author}`;
    }

    // Server invite
    const serverMatch = text.match(/🏯\s*Server\s*Invite:\s*(.*?)(?:\n|$)/i);
    if (serverMatch) {
      const serverName = serverMatch[1].trim();
      return `Sent a server invite: ${serverName}`;
    }

    return text;
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const otherUser = item.otherUser;
    const avatarSrc = getAvatarSource(otherUser?.avatar);

    return (
      <TouchableOpacity
        style={s.row}
        activeOpacity={0.75}
        onPress={() =>
          router.push({
            pathname: '/(modals)/dm/[conversationId]',
            params: {
              conversationId: item.id,
              name: otherUser?.display_name || otherUser?.username || 'User',
              avatar: otherUser?.avatar || '',
              recipientId: otherUser?.id,
            },
          } as any)
        }
        onLongPress={() => {
          // Example: Show options modal or alert
          Alert.alert(
            'Message Options',
            'Choose an action for this conversation.',
            [
              { text: 'Reply', onPress: () => router.push({ pathname: '/(modals)/dm/[conversationId]', params: { conversationId: item.id } }) },
              { text: 'Delete', onPress: () => {/* Add delete logic here */ } },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }}
      >
        {/* Avatar */}
        <View>
          {avatarSrc ? (
            <Image source={avatarSrc} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: 'rgba(99,102,241,0.25)' }]}>
              <Ionicons name="person" size={20} color="rgba(255,255,255,0.5)" />
            </View>
          )}
          {otherUser?.is_online && <View style={s.onlineBadge} />}
        </View>

        {/* Info */}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={s.name} numberOfLines={1}>
                {otherUser?.display_name || otherUser?.username || 'Unknown'}
              </Text>
              {item.isBlocked && (
                <View style={{ marginLeft: 8, backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>BLOCKED</Text>
                </View>
              )}
            </View>
            <Text style={s.time}>{timeAgo(item.last_message_at)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Text style={[s.preview, item.isBlocked ? { color: 'rgba(255,255,255,0.3)' } : {}]} numberOfLines={1}>
              {getPreviewText(item)}
            </Text>
            {(item.unreadCount ?? 0) > 0 && !item.isBlocked && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(15,15,30,0.95)' }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => safeGoBack('/home')} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {activeTab === 'messages' ? 'Messages' : 'Servers'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {activeTab === 'messages' ? (
            <TouchableOpacity onPress={openFriendPicker} style={s.newChatBtn}>
              <Ionicons name="create-outline" size={20} color="#818cf8" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleCreateServer} style={s.newChatBtn}>
              <Ionicons name="add" size={22} color="#818cf8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'messages' && s.tabActive]}
          onPress={() => setActiveTab('messages')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chatbubbles"
            size={18}
            color={activeTab === 'messages' ? '#818cf8' : 'rgba(255,255,255,0.4)'}
          />
          <Text style={[s.tabText, activeTab === 'messages' && s.tabTextActive]}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'servers' && s.tabActive]}
          onPress={() => setActiveTab('servers')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="server"
            size={18}
            color={activeTab === 'servers' ? '#818cf8' : 'rgba(255,255,255,0.4)'}
          />
          <Text style={[s.tabText, activeTab === 'servers' && s.tabTextActive]}>Servers</Text>
          {myServers.length > 0 && (
            <View style={s.tabBadge}>
              <Text style={s.tabBadgeText}>{myServers.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'messages' ? (
        <FlatList
          data={enhancedConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListHeaderComponent={
            friends.length > 0 ? (
              <View style={{ marginBottom: 6, marginTop: 8 }}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                  Friends
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
                  {friends.map((friend: any) => {
                    const fId = friend.id || friend._id;
                    const fAvatar = getAvatarSource(friend.avatar);
                    return (
                      <TouchableOpacity
                        key={fId}
                        style={s.friendBubble}
                        activeOpacity={0.7}
                        onPress={() => startDmWith(fId)}
                        disabled={startingChat === fId}
                      >
                        <View>
                          {fAvatar ? (
                            <Image source={fAvatar} style={s.friendBubbleAvatar} />
                          ) : (
                            <View style={[s.friendBubbleAvatar, { backgroundColor: 'rgba(99,102,241,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
                              <Ionicons name="person" size={18} color="rgba(255,255,255,0.5)" />
                            </View>
                          )}
                          {friend.is_online && <View style={s.friendBubbleOnline} />}
                          {startingChat === fId && (
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 25 }}>
                              <ActivityIndicator size="small" color="#fff" />
                            </View>
                          )}
                        </View>
                        <Text style={s.friendBubbleName} numberOfLines={1}>
                          {friend.display_name || friend.username}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 12 }} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="chatbubbles-outline" size={56} color="rgba(255,255,255,0.15)" />
              <Text style={s.emptyText}>No conversations yet</Text>
              <Text style={s.emptySubtext}>Tap the pen icon to start chatting</Text>
            </View>
          }
        />
      ) : (
        /* ─── Servers tab (cool cards) ─── */
        <FlatList
          data={[]}
          renderItem={() => null}
          keyExtractor={() => 'header'}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListHeaderComponent={
            <View>
              {/* Create Server Banner */}
              <TouchableOpacity
                style={s.createServerBanner}
                activeOpacity={0.7}
                onPress={handleCreateServer}
              >
                <View style={s.createServerIconWrap}>
                  <Ionicons name="add" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create a Server</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>Start your own anime community</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>

              {/* Search Bar */}
              <View style={s.svSearchBar}>
                <Ionicons name="search" size={18} color="rgba(255,255,255,0.35)" />
                <TextInput
                  value={serverSearch}
                  onChangeText={setServerSearch}
                  placeholder="Search servers..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={s.svSearchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {serverSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setServerSearch('')}>
                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.35)" />
                  </TouchableOpacity>
                )}
              </View>

              {/* My Servers section */}
              <View style={{ marginBottom: 20 }}>
                <Text style={s.svSectionTitle}>My Servers</Text>
                {filteredMyServers.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                    <Ionicons name="server-outline" size={44} color="rgba(255,255,255,0.12)" />
                    <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 8, fontSize: 14 }}>
                      {serverSearch.trim() ? 'No matching servers' : 'Join or create your first server!'}
                    </Text>
                  </View>
                ) : (
                  filteredMyServers.map((item: Server) => {
                    const sId = item.id || item._id;
                    const memberCount = (item as any).memberCount ?? (item as any).member_count ?? 0;
                    const iconUri = (item as any).icon;
                    const hasIcon = !!iconUri && !iconUri.includes('dicebear');
                    return (
                      <TouchableOpacity
                        key={sId}
                        onPress={() => router.push(`/(modals)/server/${sId}`)}
                        style={s.svCard}
                        activeOpacity={0.85}
                      >
                        {hasIcon ? (
                          <Image source={{ uri: iconUri }} style={s.svBgImage} blurRadius={Platform.OS === 'ios' ? 30 : 18} resizeMode="cover" />
                        ) : (
                          <View style={[s.svBgImage, { backgroundColor: '#1e1b4b' }]} />
                        )}
                        <View style={s.svCardOverlay} />
                        <View style={s.svCardContent}>
                          <View style={s.svCardTopRow}>
                            {hasIcon ? (
                              <Image source={{ uri: iconUri }} style={s.svSharpIcon} />
                            ) : (
                              <View style={[s.svSharpIcon, s.svIconPlaceholder]}>
                                <Ionicons name="server" size={20} color="#818cf8" />
                              </View>
                            )}
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={s.svServerName} numberOfLines={1}>{item.name}</Text>
                                <View style={s.svJoinedBadge}>
                                  <Text style={s.svJoinedText}>Joined</Text>
                                </View>
                              </View>
                              <Text style={s.svServerDesc} numberOfLines={2}>{item.description || 'No description'}</Text>
                            </View>
                          </View>
                          <View style={s.svStatsRow}>
                            <View style={s.svStatItem}>
                              <Ionicons name="people" size={13} color="rgba(255,255,255,0.55)" />
                              <Text style={s.svStatText}>{memberCount} members</Text>
                            </View>
                            {((item as any).animeTheme || (item as any).anime_theme) ? (
                              <View style={s.svStatItem}>
                                <Ionicons name="star" size={13} color="#f472b6" />
                                <Text style={{ color: '#f472b6', fontWeight: '600', fontSize: 12 }}>{(item as any).animeTheme || (item as any).anime_theme}</Text>
                              </View>
                            ) : null}
                          </View>
                          {((item as any).tags?.length ?? 0) > 0 && (
                            <View style={s.svTagsRow}>
                              {(item as any).tags.slice(0, 3).map((tag: string) => (
                                <View key={tag} style={s.svTag}>
                                  <Text style={s.svTagText}>#{tag}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {/* Discover Servers section */}
              <View style={{ marginBottom: 20 }}>
                <Text style={s.svSectionTitle}>Discover Servers</Text>
                {filteredPublicServers.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                    <Ionicons name="server-outline" size={44} color="rgba(255,255,255,0.12)" />
                    <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 8, fontSize: 14 }}>
                      {serverSearch.trim() ? 'No matching servers' : 'No public servers available yet'}
                    </Text>
                  </View>
                ) : (
                  filteredPublicServers.map((item: Server) => {
                    const sId = item.id || item._id;
                    const memberCount = (item as any).memberCount ?? (item as any).member_count ?? 0;
                    const iconUri = (item as any).icon;
                    const hasIcon = !!iconUri && !iconUri.includes('dicebear');
                    return (
                      <TouchableOpacity
                        key={sId}
                        onPress={() => router.push(`/(modals)/server/${sId}`)}
                        style={s.svCard}
                        activeOpacity={0.85}
                      >
                        {hasIcon ? (
                          <Image source={{ uri: iconUri }} style={s.svBgImage} blurRadius={Platform.OS === 'ios' ? 30 : 18} resizeMode="cover" />
                        ) : (
                          <View style={[s.svBgImage, { backgroundColor: '#1e1b4b' }]} />
                        )}
                        <View style={s.svCardOverlay} />
                        <View style={s.svCardContent}>
                          <View style={s.svCardTopRow}>
                            {hasIcon ? (
                              <Image source={{ uri: iconUri }} style={s.svSharpIcon} />
                            ) : (
                              <View style={[s.svSharpIcon, s.svIconPlaceholder]}>
                                <Ionicons name="server" size={20} color="#818cf8" />
                              </View>
                            )}
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={s.svServerName} numberOfLines={1}>{item.name}</Text>
                              <Text style={s.svServerDesc} numberOfLines={2}>{item.description || 'No description'}</Text>
                            </View>
                          </View>
                          <View style={s.svStatsRow}>
                            <View style={s.svStatItem}>
                              <Ionicons name="people" size={13} color="rgba(255,255,255,0.55)" />
                              <Text style={s.svStatText}>{memberCount} members</Text>
                            </View>
                            {((item as any).animeTheme || (item as any).anime_theme) ? (
                              <View style={s.svStatItem}>
                                <Ionicons name="star" size={13} color="#f472b6" />
                                <Text style={{ color: '#f472b6', fontWeight: '600', fontSize: 12 }}>{(item as any).animeTheme || (item as any).anime_theme}</Text>
                              </View>
                            ) : null}
                          </View>
                          {((item as any).tags?.length ?? 0) > 0 && (
                            <View style={s.svTagsRow}>
                              {(item as any).tags.slice(0, 3).map((tag: string) => (
                                <View key={tag} style={s.svTag}>
                                  <Text style={s.svTagText}>#{tag}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          }
        />
      )}

      {/* Friends picker modal */}
      <Modal visible={showFriendPicker} transparent animationType="slide" onRequestClose={() => setShowFriendPicker(false)}>
        <View style={s.pickerOverlay}>
          <View style={[s.pickerSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>New Chat</Text>
              <TouchableOpacity onPress={() => setShowFriendPicker(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            {loadingFriends ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <ActivityIndicator color="#6366f1" />
                <Text style={[s.emptySubtext, { marginTop: 10 }]}>Loading friends…</Text>
              </View>
            ) : friends.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.12)" />
                <Text style={s.emptyText}>No friends yet</Text>
                <Text style={s.emptySubtext}>Add friends to start chatting</Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(f: any) => f.id || f._id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: friend }: any) => {
                  const fId = friend.id || friend._id;
                  const fAvatar = getAvatarSource(friend.avatar);
                  return (
                    <TouchableOpacity
                      style={s.friendRow}
                      activeOpacity={0.7}
                      onPress={() => startDmWith(fId)}
                      disabled={startingChat === fId}
                    >
                      {fAvatar ? (
                        <Image source={fAvatar} style={s.friendAvatar} />
                      ) : (
                        <View style={[s.friendAvatar, { backgroundColor: 'rgba(99,102,241,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="person" size={18} color="rgba(255,255,255,0.5)" />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.friendName}>{friend.display_name || friend.username}</Text>
                        {friend.is_online && <Text style={{ color: '#22c55e', fontSize: 11, marginTop: 1 }}>Online</Text>}
                      </View>
                      {startingChat === fId ? (
                        <ActivityIndicator size="small" color="#6366f1" />
                      ) : (
                        <Ionicons name="chatbubble-outline" size={20} color="#818cf8" />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Server friends gate modal */}
      <Modal visible={showServerGate} transparent animationType="fade" onRequestClose={() => setShowServerGate(false)}>
        <View style={s.gateOverlay}>
          <View style={s.gateBox}>
            <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>👥</Text>
            <Text style={s.gateTitle}>Minimum 2 Friends Required</Text>
            <Text style={s.gateDesc}>
              You need at least 2 friends to create a server. Start connecting with other anime fans first!
            </Text>
            <Text style={s.gateCount}>Current friends: {friends.length}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity style={s.gateBtn} onPress={() => setShowServerGate(false)}>
                <Text style={s.gateBtnText}>Got it</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.gateBtn, { backgroundColor: '#22c55e' }]}
                onPress={() => {
                  setShowServerGate(false);
                  router.push('/(auth)/add-friends');
                }}
              >
                <Text style={s.gateBtnText}>Add Friends</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
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

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: 'rgba(15,15,30,0.95)',
  },
  name: { color: '#fff', fontWeight: '700', fontSize: 15, flex: 1, marginRight: 8 },
  time: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  preview: { color: 'rgba(255,255,255,0.45)', fontSize: 13, flex: 1 },
  badge: {
    backgroundColor: '#6366f1',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 100 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '600', marginTop: 14 },
  emptySubtext: { color: 'rgba(255,255,255,0.25)', fontSize: 13, marginTop: 4 },

  newChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(99,102,241,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Friends picker */
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingHorizontal: 20,
    paddingTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  friendAvatar: { width: 42, height: 42, borderRadius: 21 },
  friendName: { color: '#fff', fontWeight: '600', fontSize: 15 },

  /* Friend bubbles (horizontal row) */
  friendBubble: {
    alignItems: 'center',
    marginRight: 16,
    width: 56,
  },
  friendBubbleAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  friendBubbleOnline: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: 'rgba(15,15,30,0.95)',
  },
  friendBubbleName: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
  },

  /* Server friends gate modal */
  gateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gateBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.2)',
  },
  gateTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  gateDesc: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  gateCount: {
    color: '#818cf8',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 16,
  },
  gateBtn: {
    backgroundColor: '#818cf8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  gateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  /* ─── Tabs ─── */
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabActive: {
    backgroundColor: 'rgba(99,102,241,0.15)',
  },
  tabText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#818cf8',
  },
  tabBadge: {
    backgroundColor: '#6366f1',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 2,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  /* ─── Cool server cards ─── */
  svCard: {
    borderRadius: 18,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative' as const,
    minHeight: 130,
  },
  svBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%' as any,
    height: '100%' as any,
  },
  svCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 20, 0.72)',
  },
  svCardContent: {
    padding: 16,
    zIndex: 1,
  },
  svCardTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  svSharpIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  svIconPlaceholder: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  svServerName: { color: '#fff', fontWeight: '700' as const, fontSize: 16, flex: 1, marginRight: 8 },
  svServerDesc: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 18, marginTop: 2 },
  svStatsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    marginTop: 12,
  },
  svStatItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  svStatText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  svJoinedBadge: { backgroundColor: '#6366f1', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  svJoinedText: { color: '#fff', fontSize: 11, fontWeight: '700' as const },
  svTagsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginTop: 10,
  },
  svTag: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  svTagText: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  svSectionTitle: { fontSize: 18, fontWeight: '700' as const, color: '#fff', marginBottom: 12 },
  svSearchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginTop: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  svSearchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    padding: 0,
  },
  createServerBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
    gap: 12,
  },
  createServerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
