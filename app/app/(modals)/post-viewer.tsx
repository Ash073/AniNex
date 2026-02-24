import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ViewToken,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { postService } from '@/services/postService';
import { useAuthStore } from '@/store/authStore';
import { safeGoBack } from '@/utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AutoImage from '@/components/AutoImage';
import { Post } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

function formatPostTime(dateStr?: string | Date) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sameYear = d.getFullYear() === new Date().getFullYear();
  if (sameYear) return `${months[d.getMonth()]} ${d.getDate()}`;
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function PostViewerScreen() {
  const { userId, startIndex: startIndexStr } = useLocalSearchParams<{ userId: string; startIndex: string }>();
  const startIndex = parseInt(startIndexStr || '0', 10);
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['user-posts', userId],
    queryFn: () => postService.getUserPosts(userId),
    enabled: !!userId,
  });

  // Track post view when a post is viewed
  useEffect(() => {
    if (posts.length > 0 && currentIndex >= 0) {
      const currentPost = posts[currentIndex];
      if (currentPost) {
        const trackView = async () => {
          try {
            const postId = currentPost.id || currentPost._id;
            if (postId) {
              await postService.viewPost(postId);
              // Update the local cache with the new view count
              queryClient.setQueryData(['user-posts', userId], (old: any[]) => {
                if (!old) return old;
                return old.map((p, idx) => {
                  if (idx === currentIndex) {
                    return {
                      ...p,
                      viewCount: (p.viewCount || 0) + 1
                    };
                  }
                  return p;
                });
              });
            }
          } catch (error) {
            console.warn('Failed to track post view:', error);
          }
        };
        
        trackView();
      }
    }
  }, [currentIndex, posts, queryClient]);

  const handleLike = async (postId: string) => {
    queryClient.setQueryData(['user-posts', userId], (old: Post[] | undefined) =>
      (old || []).map((p) =>
        (p._id || p.id) === postId
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              like_count: (p.like_count ?? p.likeCount ?? 0) + (p.liked_by_me ? -1 : 1),
            }
          : p,
      ),
    );
    try {
      await postService.likePost(postId);
      queryClient.invalidateQueries({ queryKey: ['user-posts', userId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (e) {
      queryClient.invalidateQueries({ queryKey: ['user-posts', userId] });
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
            safeGoBack('/profile');
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete post');
          }
        },
      },
    ]);
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderPost = useCallback(({ item: post }: { item: Post }) => {
    const authorAvatar = getAvatarSource(post.author?.avatar);
    const postId = post.id || post._id || '';
    const isMyPost = (post.author_id || post.author?.id) === (user?.id || (user as any)?._id);

    return (
      <View style={st.postPage}>
        {/* Author */}
        <TouchableOpacity
          style={st.authorRow}
          activeOpacity={0.7}
          onPress={() => {
            const authorId = post.author_id || post.author?.id;
            if (authorId && authorId !== (user?.id || user?._id)) {
              router.push(`/(modals)/user-profile?userId=${authorId}` as any);
            }
          }}
        >
          {authorAvatar ? (
            <Image 
              source={authorAvatar} 
              style={st.authorAvatar} 
              resizeMode="cover"
              fadeDuration={0} // Disable fade animation on Android
            />
          ) : (
            <View style={[st.authorAvatar, { backgroundColor: 'rgba(99,102,241,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="person" size={18} color="rgba(255,255,255,0.5)" />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={st.authorName}>{post.author?.display_name || post.author?.username || 'Anonymous'}</Text>
            <Text style={st.authorDate}>{formatPostTime(post.created_at || post.createdAt)}</Text>
          </View>
          <View style={st.categoryBadge}>
            <Text style={st.categoryText}>{post.category}</Text>
          </View>
          {isMyPost && (
            <TouchableOpacity
              style={{ marginLeft: 8, padding: 4 }}
              onPress={() => handleDeletePost(postId)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Content */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
          {post.title ? <Text style={st.title}>{post.title}</Text> : null}
          <Text style={st.content}>{post.content}</Text>

          {(post.images?.length ?? 0) > 0 && (
            <View style={{ marginBottom: 12 }}>
              {post.images.map((img: string, idx: number) => (
                <AutoImage
                  key={idx}
                  uri={img}
                  borderRadius={14}
                  marginBottom={8}
                />
              ))}
            </View>
          )}

          {(post.tags?.length ?? 0) > 0 && (
            <View style={st.tagRow}>
              {post.tags.map((tag: string) => (
                <View key={tag} style={st.tag}>
                  <Text style={st.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Actions bar */}
        <View style={st.actionsBar}>
          <TouchableOpacity onPress={() => handleLike(postId)} style={st.actionBtn}>
            <Ionicons name={post.liked_by_me ? 'heart' : 'heart-outline'} size={24} color="#ec4899" />
            <Text style={st.actionText}>{post.like_count ?? post.likeCount ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={st.actionBtn}
            onPress={() => router.push(`/(modals)/post/${postId}`)}
          >
            <Ionicons name="chatbubble-outline" size={22} color="rgba(255,255,255,0.6)" />
            <Text style={st.actionText}>{post.comment_count ?? post.commentCount ?? 0}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [user, handleLike]);

  if (isLoading) {
    return (
      <View style={[st.container, { paddingTop: insets.top }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </View>
    );
  }

  return (
    <View style={st.container}>
      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => safeGoBack('/profile')} style={st.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>
          {currentIndex + 1} / {posts.length}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id || item._id || ''}
        showsVerticalScrollIndicator={false}
        initialScrollIndex={startIndex > 0 ? startIndex : undefined}
        getItemLayout={startIndex > 0 ? (_, index) => ({
          length: 400,
          offset: 400 * index,
          index,
        }) : undefined}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />}
        contentContainerStyle={{ paddingBottom: 60 }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0a0a14',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },

  postPage: {
    width: SCREEN_WIDTH,
  },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  authorAvatar: { width: 40, height: 40, borderRadius: 20 },
  authorName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  authorDate: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 },
  categoryBadge: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: { color: '#818cf8', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  title: { color: '#fff', fontWeight: '800', fontSize: 20, marginBottom: 8 },
  content: { color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 22, marginBottom: 12 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagText: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },

  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
