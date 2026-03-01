import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { postService } from '@/services/postService';
import { recommendationService } from '@/services/recommendationService';
import { friendService } from '@/services/friendService';
import { dmService } from '@/services/dmService';
import { authService } from '@/services/authService';
import { notificationService } from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { Post } from '@/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AutoImage from '@/components/AutoImage';

const CATEGORIES = ['discussion', 'review', 'fan-art', 'meme'] as const;

// Avatar helpers
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
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const sameYear = d.getFullYear() === new Date().getFullYear();
  if (sameYear) return `${months[d.getMonth()]} ${d.getDate()}`;
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();
  const { resetUnread } = useChatStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sharePostData, setSharePostData] = useState<any>(null);
  const queryClient = useQueryClient();
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Add loading state for better UX
  const [loading, setLoading] = useState(true);
  const [pendingFriendId, setPendingFriendId] = useState<string | null>(null);

  const { data: posts = [], refetch, isLoading } = useQuery({
    queryKey: ['posts', selectedCategory],
    queryFn: () =>
      postService.getPosts({
        category: selectedCategory || undefined,
        limit: 20,
      }),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Recommendations
  const { data: recommendedUsers = [] } = useQuery({
    queryKey: ['recommended-users'],
    queryFn: () => recommendationService.getRecommendedUsers(8),
  });

  // Sent requests for button state
  const { data: sentRequests = [] } = useQuery({
    queryKey: ['friend-requests-sent'],
    queryFn: () => friendService.getSent(),
  });

  // Notification unread count
  const { data: notifCount = 0 } = useQuery({
    queryKey: ['notification-count'],
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 30000, // poll every 30s
  });

  // DM unread count (real DB count)
  const { data: dmUnreadCount = 0 } = useQuery({
    queryKey: ['dm-unread-count'],
    queryFn: () => dmService.getTotalUnread(),
    refetchInterval: 15000, // poll every 15s
  });

  const sentToIds = new Set(sentRequests.map((r: any) => r.receiver_id));
  const myFriendIds = new Set(user?.friends || []);

  const refreshCurrentUser = async () => {
    try {
      const freshUser = await authService.getCurrentUser();
      setUser(freshUser);
    } catch (e) {
      console.error('Failed to refresh user:', e);
    }
  };

  const sendRequestMutation = useMutation({
    mutationFn: (userId: string) => friendService.sendRequest(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests-sent'] });
      queryClient.invalidateQueries({ queryKey: ['recommended-users'] });
      refreshCurrentUser();
    },
    onSettled: () => {
      setPendingFriendId(null);
    },
  });

  const handleAddFriend = (userId: string) => {
    if (myFriendIds.has(userId) || sentToIds.has(userId)) return;
    setPendingFriendId(userId);
    sendRequestMutation.mutate(userId);
  };

  const getFriendStatus = (userId: string): 'friends' | 'pending' | 'none' => {
    if (myFriendIds.has(userId)) return 'friends';
    if (sentToIds.has(userId)) return 'pending';
    return 'none';
  };

  // Friends list for share modal
  const { data: friendsForShare = [] } = useQuery({
    queryKey: ['friends-list'],
    queryFn: () => friendService.getFriends(),
  });

  const handleSharePost = async (friendUserId: string) => {
    if (!sharePostData) return;
    try {
      const conversation = await dmService.startConversation(friendUserId);
      const convId = (conversation as any)._id || conversation.id || (conversation as any).conversation?.id;
      const authorName = sharePostData.author?.display_name || sharePostData.author?.username || 'Someone';
      const msg = `📝 Shared Post by ${authorName}\n${sharePostData.title ? '「' + sharePostData.title + '」\n' : ''}${sharePostData.content ? sharePostData.content.slice(0, 120) + (sharePostData.content.length > 120 ? '…' : '') + '\n' : ''}${sharePostData.anime_title ? '🎭 ' + sharePostData.anime_title + '\n' : ''}\n[post:${sharePostData._id || sharePostData.id}]`;
      await dmService.sendMessage(convId, msg);
      Alert.alert('Shared!', 'Post sent to your friend.');
      setSharePostData(null);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to share post');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['recommended-users'] }),
    ]);
    setRefreshing(false);
  }, [refetch, queryClient]);

  const handleLike = async (postId: string) => {
    // Optimistic update
    queryClient.setQueryData(['posts', selectedCategory], (old: Post[] | undefined) =>
      (old || []).map((p) =>
        (p._id || p.id) === postId
          ? {
            ...p,
            liked_by_me: !p.liked_by_me,
            like_count: (p.like_count ?? p.likeCount ?? 0) + (p.liked_by_me ? -1 : 1),
            likeCount: (p.likeCount ?? p.like_count ?? 0) + (p.liked_by_me ? -1 : 1),
          }
          : p,
      ),
    );
    try {
      await postService.likePost(postId);
      refetch();
    } catch (error) {
      console.error('Failed to like post:', error);
      refetch(); // revert on error
    }
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await postService.deletePost(postId);
            queryClient.invalidateQueries({ queryKey: ['posts'] });
            queryClient.invalidateQueries({ queryKey: ['user-posts'] });
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete post');
          }
        },
      },
    ]);
  };

  /* ─── Greeting ─── */
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  /* ─── Render helpers ─── */

  /** Render post content with styled @mentions */
  const renderPostContent = (text: string, numberOfLines?: number) => {
    // Split by @mention pattern
    const parts = text.split(/(@\w+)/g);
    if (parts.length === 1) {
      return (
        <Text style={s.postBody} numberOfLines={numberOfLines}>
          {text}
        </Text>
      );
    }
    return (
      <Text style={s.postBody} numberOfLines={numberOfLines}>
        {parts.map((part, i) => {
          if (part.startsWith('@') && part.length > 1) {
            return (
              <Text
                key={i}
                style={s.mentionText}
                onPress={() => {
                  // Navigate to user profile
                  const username = part.substring(1);
                  // Just navigate to discover for now
                }}
              >
                {part}
              </Text>
            );
          }
          return <Text key={i}>{part}</Text>;
        })}
      </Text>
    );
  };

  const ListHeader = () => (
    <View style={{ paddingTop: insets.top + 12 }}>
      {/* Top bar: greeting + action buttons */}
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.greetingSmall}>{greeting}</Text>
          <Text style={s.greetingName}>{user?.displayName || user?.username || 'Otaku'}</Text>
        </View>

        {/* Create post */}
        <TouchableOpacity
          style={s.topBtn}
          onPress={() => router.push('/(modals)/create-post')}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Notifications */}
        <TouchableOpacity
          style={[s.topBtn, { marginLeft: 10 }]}
          onPress={() => router.push('/(modals)/notifications' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications" size={20} color="#fff" />
          {notifCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Servers / messages */}
        <TouchableOpacity
          style={[s.topBtn, { marginLeft: 10 }]}
          onPress={() => {
            resetUnread();
            queryClient.invalidateQueries({ queryKey: ['dm-unread-count'] });
            router.push('/(modals)/messages');
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubbles" size={20} color="#fff" />
          {dmUnreadCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{dmUnreadCount > 99 ? '99+' : dmUnreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Category pills */}
      <View style={s.pillRow}>
        <TouchableOpacity
          style={[s.pill, !selectedCategory && s.pillActive]}
          onPress={() => setSelectedCategory(null)}
          activeOpacity={0.7}
        >
          <Text style={[s.pillText, !selectedCategory && s.pillTextActive]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[s.pill, selectedCategory === cat && s.pillActive]}
            onPress={() => setSelectedCategory(cat)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                s.pillText,
                selectedCategory === cat && s.pillTextActive,
                { textTransform: 'capitalize' },
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* People You Might Like */}
      {recommendedUsers.length > 0 && (
        <View style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={s.sectionTitle}>People You Might Like</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/discover')} activeOpacity={0.7}>
              <Text style={{ color: '#818cf8', fontSize: 13, fontWeight: '600' }}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recommendedUsers.slice(0, 6).map((rec: any) => {
              const uid = rec._id || rec.id;
              const avatarSrc = getAvatarSource(rec.avatar);
              const status = getFriendStatus(uid);
              return (
                <TouchableOpacity
                  key={uid}
                  style={s.recCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(modals)/user-profile?userId=${uid}` as any)}
                >
                  {avatarSrc ? (
                    <Image
                      source={avatarSrc}
                      style={s.recAvatar}
                      resizeMode="cover"
                      fadeDuration={0} // Disable fade animation on Android
                    />
                  ) : (
                    <View style={[s.recAvatar, { backgroundColor: 'rgba(99,102,241,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="person" size={22} color="rgba(255,255,255,0.5)" />
                    </View>
                  )}
                  <Text style={s.recName} numberOfLines={1}>{rec.display_name || rec.displayName || rec.username}</Text>
                  {rec.bio ? (
                    <Text style={s.recBio} numberOfLines={2}>{rec.bio}</Text>
                  ) : null}
                  {status === 'friends' ? (
                    <View style={s.recBtnFriends}>
                      <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                      <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>Friends</Text>
                    </View>
                  ) : status === 'pending' ? (
                    <View style={s.recBtnPending}>
                      <Ionicons name="time-outline" size={14} color="#f59e0b" />
                      <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '700' }}>Pending</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={s.recBtnAdd}
                      onPress={() => handleAddFriend(uid)}
                      activeOpacity={0.7}
                      disabled={pendingFriendId === uid}
                    >
                      {pendingFriendId === uid ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="person-add-outline" size={14} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Add</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Loading indicator */}
      {isLoading && posts.length === 0 && (
        <View style={{ marginBottom: 16 }}>
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      )}
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => {
    const authorAvatar = getAvatarSource(item.author?.avatar);
    const postId = item._id || item.id;

    // Debug logging
    console.log('Rendering post:', { id: postId, title: item.title, content: item.content?.substring(0, 50) });

    const isMyPost = (item.author_id || item.author?.id || item.author?._id) === (user?.id || user?._id);
    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.85}
        onPress={() => router.push(`/(modals)/post/${postId}`)}
      >
        {/* Author row with enhanced spacing */}
        <View style={s.authorRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              const authorId = item.author_id || item.author?.id || item.author?._id;
              if (authorId) router.push(`/(modals)/user-profile?userId=${authorId}` as any);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          >
            {authorAvatar ? (
              <Image
                source={authorAvatar}
                style={s.authorAvatar}
                resizeMode="cover"
                fadeDuration={0} // Disable fade animation on Android
              />
            ) : (
              <View style={[s.authorAvatar, { backgroundColor: 'rgba(99,102,241,0.3)', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={16} color="rgba(255,255,255,0.5)" />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.authorName}>{item.author?.username ?? 'Anonymous'}</Text>
              <Text style={s.authorDate}>
                {formatPostTime(item.createdAt || item.created_at)}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={s.categoryBadge}>
            <Text style={s.categoryText}>{item.category}</Text>
          </View>
          {isMyPost && (
            <TouchableOpacity
              style={{ marginLeft: 10, padding: 6 }}
              onPress={() => handleDeletePost(postId)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        {/* Enhanced title with better hierarchy */}
        {item.title ? <Text style={s.postTitle}>{item.title}</Text> : null}
        {renderPostContent(item.content, 4)}

        {/* Mentions indicator */}
        {(item.mentions ?? []).length > 0 && (
          <View style={s.mentionsRow}>
            <Ionicons name="at" size={12} color="#818cf8" />
            <Text style={s.mentionsText}>
              {(item.mentions ?? []).length} mention{(item.mentions ?? []).length > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* Image gallery with multiple image support */}
        {item.images?.length > 0 && (
          <View style={{ marginBottom: 14, marginTop: 6 }}>
            {item.images.length === 1 ? (
              <AutoImage
                uri={item.images[0]}
                borderRadius={16}
                marginBottom={0}
              />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -4 }}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
              >
                {item.images.slice(0, 4).map((imgUri: string, imgIdx: number) => (
                  <View key={imgIdx} style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: imgUri }}
                      style={{
                        width: 180,
                        height: 180,
                        borderRadius: 14,
                      }}
                      resizeMode="cover"
                    />
                    {imgIdx === 3 && item.images.length > 4 && (
                      <View style={s.moreImagesOverlay}>
                        <Text style={s.moreImagesText}>+{item.images.length - 4}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Enhanced tags with better layout */}
        {item.tags?.length > 0 && (
          <View style={s.tagRow}>
            {item.tags.slice(0, 4).map((t) => (
              <View key={t} style={s.tag}>
                <Text style={s.tagText}>#{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Engagement indicators */}
        <View style={s.engagementRow}>
          <View style={s.engagementBadge}>
            <Ionicons name="eye-outline" size={14} color="rgba(255,255,255,0.4)" />
            <Text style={s.engagementText}>
              {item.viewCount ?? 0} views
            </Text>
          </View>
          {(item.likeCount ?? item.like_count ?? 0) > 10 && (
            <View style={s.trendingBadge}>
              <Ionicons name="flame" size={12} color="#f97316" />
              <Text style={s.trendingText}>Trending</Text>
            </View>
          )}
        </View>

        {/* Enhanced actions with better separation */}
        <View style={s.actionRow}>
          <TouchableOpacity
            onPress={() => handleLike(item._id || item.id)}
            style={s.actionBtn}
          >
            <Ionicons
              name={item.liked_by_me ? 'heart' : 'heart-outline'}
              size={20}
              color="#ec4899"
            />
            <Text style={s.actionText}>{item.likeCount ?? item.like_count ?? 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => router.push(`/(modals)/post/${postId}`)}
          >
            <Ionicons name="chatbubble-outline" size={20} color="rgba(255,255,255,0.6)" />
            <Text style={s.actionText}>{item.commentCount ?? item.comment_count ?? 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={() => setSharePostData(item)}>
            <Ionicons name="paper-plane-outline" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Add skeleton loading component
  const SkeletonCard = () => (
    <View style={s.skeletonCard}>
      <View style={s.skeletonHeader}>
        <View style={s.skeletonAvatar} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={s.skeletonLine} />
          <View style={[s.skeletonLine, { width: '60%', marginTop: 8 }]} />
        </View>
      </View>
      <View style={{ marginTop: 12 }}>
        <View style={[s.skeletonLine, { width: '90%' }]} />
        <View style={[s.skeletonLine, { width: '100%', marginTop: 8 }]} />
        <View style={[s.skeletonLine, { width: '80%', marginTop: 8 }]} />
      </View>
      <View style={s.skeletonActions}>
        <View style={s.skeletonAction} />
        <View style={s.skeletonAction} />
        <View style={s.skeletonAction} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a14' }}>
      <FlatList
        data={posts as Post[]}
        renderItem={renderPost}
        keyExtractor={(item) => item._id || item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={s.empty}>
              <Animated.View style={{ opacity: fadeAnim }}>
                <Ionicons name="document-text-outline" size={64} color="rgba(255,255,255,0.2)" />
                <Text style={s.emptyTitle}>No posts yet</Text>
                <Text style={s.emptyText}>Be the first to share your thoughts!</Text>
                <TouchableOpacity
                  style={s.emptyButton}
                  onPress={() => router.push('/(modals)/create-post')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={s.emptyButtonText}>Create Post</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )
        }
      />

      {/* Share Post Modal */}
      <Modal
        visible={!!sharePostData}
        transparent
        animationType="fade"
        onRequestClose={() => setSharePostData(null)}
      >
        <TouchableOpacity
          style={s.shareOverlay}
          activeOpacity={1}
          onPress={() => setSharePostData(null)}
        >
          <View style={s.shareModal} onStartShouldSetResponder={() => true}>
            <Text style={s.shareTitle}>Share Post</Text>
            <Text style={s.shareSubtitle}>Send this post to a friend via DM</Text>

            {/* Post preview */}
            {sharePostData && (
              <View style={s.sharePreview}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
                  {sharePostData.title || sharePostData.content?.slice(0, 40) || 'Post'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                  by {sharePostData.author?.display_name || sharePostData.author?.username || 'Unknown'}
                </Text>
              </View>
            )}

            <ScrollView style={{ marginTop: 12, maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {friendsForShare.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  <Ionicons name="people-outline" size={36} color="rgba(255,255,255,0.12)" />
                  <Text style={{ color: 'rgba(255,255,255,0.35)', marginTop: 8, fontSize: 13 }}>
                    No friends to share with
                  </Text>
                </View>
              ) : (
                friendsForShare.map((friend: any) => {
                  const fAvatar = getAvatarSource(friend.avatar);
                  return (
                    <TouchableOpacity
                      key={friend.id || friend._id}
                      style={s.shareFriendRow}
                      onPress={() => handleSharePost(friend.id || friend._id)}
                      activeOpacity={0.7}
                    >
                      {fAvatar ? (
                        <Image source={fAvatar} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      ) : (
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '700' }}>
                            {(friend.display_name || friend.username || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                          {friend.display_name || friend.username}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                          @{friend.username}
                        </Text>
                      </View>
                      <Ionicons name="send-outline" size={18} color="#818cf8" />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity
              style={{ alignItems: 'center', paddingVertical: 12, marginTop: 10 }}
              onPress={() => setSharePostData(null)}
              activeOpacity={0.7}
            >
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  /* Top bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetingSmall: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  greetingName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#0a0a14',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  /* Category pills */
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pillActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  pillText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },

  /* Card with enhanced depth */
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any)
      : {}),
  },

  /* Author */
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  authorAvatar: { width: 36, height: 36, borderRadius: 18 },
  authorName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  authorDate: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 },
  categoryBadge: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  /* Post content with better hierarchy */
  postTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 8,
    lineHeight: 24,
  },
  postBody: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  mentionText: {
    color: '#818cf8',
    fontWeight: '700',
  },
  mentionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  mentionsText: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '600',
  },
  moreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreImagesText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  postImage: { width: '100%', height: 180, borderRadius: 12, marginBottom: 10 },

  /* Engagement indicators */
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    marginTop: 4,
  },
  engagementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  engagementText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249,115,22,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
  },
  trendingText: {
    color: '#f97316',
    fontSize: 12,
    fontWeight: '600',
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },

  /* Actions with better spacing */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Empty state with better UX */
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.35)',
    marginTop: 8,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },

  /* Section title */
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },

  /* Recommendation cards with enhanced design */
  recCard: {
    width: 135,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  recAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  recName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  recBio: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 16,
    minHeight: 32,
  },
  recBtnAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 'auto' as any,
    shadowColor: '#6366f1',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  recBtnPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    marginTop: 'auto' as any,
  },
  recBtnFriends: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    marginTop: 'auto' as any,
  },

  /* Share Modal */
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  shareModal: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  shareTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  shareSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 },
  sharePreview: {
    backgroundColor: 'rgba(99,102,241,0.08)',
    borderRadius: 12,
    padding: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.15)',
  },
  shareFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },

  /* Skeleton */
  skeletonCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as any)
      : {}),
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  skeletonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skeletonLine: {
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
  },
  skeletonActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  skeletonAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
