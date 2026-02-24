import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReportModal from '@/components/ReportModal';
import { postService } from '@/services/postService';
import { friendService } from '@/services/friendService';
import { dmService } from '@/services/dmService';
import BlockButton from '@/components/BlockButton';
import { useAuthStore } from '@/store/authStore';
import { safeGoBack } from '@/utils/navigation';
import { useNavigationTracking } from '@/hooks/navigationHistory';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AutoImage from '@/components/AutoImage';

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
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const d = new Date(dateStr);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const sameYear = d.getFullYear() === new Date().getFullYear();
  if (sameYear) return `${months[d.getMonth()]} ${d.getDate()}`;
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useNavigationTracking(`/post/${id}`);

  // Debug logging
  useEffect(() => {
    console.log('Post detail screen loaded with ID:', id);
    console.log('User authenticated:', !!user);
    if (user) {
      console.log('User ID:', user.id || user._id);
    }
  }, [id, user]);

  // Fetch real post from API
  const { data: post, isLoading: postLoading, refetch: refetchPost, error: fetchError } = useQuery({
    queryKey: ['post', id],
    queryFn: async () => {
      if (!id) {
        throw new Error('No post ID provided');
      }
      
      try {
        const postData = await postService.getPost(id);
        console.log('Post data received:', postData);
        setError(null);
        return postData;
      } catch (error: any) {
        console.error('Error fetching post:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Failed to load post';
        setError(errorMessage);
        throw error;
      }
    },
    enabled: !!id && !!user,
    staleTime: 5000, // Cache for 5 seconds
    retry: 1, // Only retry once
  });

  // Track post view when the post is loaded
  useEffect(() => {
    if (post && id) {
      const trackView = async () => {
        try {
          await postService.viewPost(id);
          // Update the local cache with the new view count
          queryClient.setQueryData(['post', id], (old: any) => ({
            ...old,
            viewCount: (old?.viewCount || 0) + 1
          }));
        } catch (error) {
          console.warn('Failed to track post view:', error);
        }
      };
      
      trackView();
    }
  }, [post, id, queryClient]);

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => postService.getComments(id),
    enabled: !!id,
  });

  // Friends list for share modal
  const { data: friendsForShare = [] } = useQuery({
    queryKey: ['friends-list'],
    queryFn: () => friendService.getFriends(),
  });

  const handleSharePost = async (friendUserId: string) => {
    if (!post) return;
    try {
      const conversation = await dmService.startConversation(friendUserId);
      const convId = conversation._id || conversation.id || (conversation as any).conversation?.id;
      const authorName = post.author?.display_name || post.author?.username || 'Someone';
      const msg = `📝 Shared Post by ${authorName}\n${post.title ? '「' + post.title + '」\n' : ''}${post.content ? post.content.slice(0, 120) + (post.content.length > 120 ? '…' : '') + '\n' : ''}${post.anime_title ? '🎭 ' + post.anime_title + '\n' : ''}\n[post:${post._id || post.id}]`;
      await dmService.sendMessage(convId, msg);
      Alert.alert('Shared!', 'Post sent to your friend.');
      setShowShareModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to share post');
    }
  };

  const handleLike = async () => {
    // Optimistic update
    queryClient.setQueryData(['post', id], (old: any) =>
      old
        ? {
            ...old,
            liked_by_me: !old.liked_by_me,
            like_count: (old.like_count ?? old.likeCount ?? 0) + (old.liked_by_me ? -1 : 1),
            likeCount: (old.likeCount ?? old.like_count ?? 0) + (old.liked_by_me ? -1 : 1),
          }
        : old,
    );
    try {
      await postService.likePost(id);
      refetchPost();
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (error) {
      console.error('Failed to like post:', error);
      refetchPost(); // revert on error
    }
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    if (post?.commentsEnabled === false) {
      Alert.alert('Comments Disabled', 'The creator has disabled comments on this post.');
      return;
    }
    setLoading(true);
    try {
      await postService.addComment(id, commentText.trim());
      setCommentText('');
      refetchComments();
      refetchPost();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to post comment');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = () => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await postService.deletePost(id);
            queryClient.invalidateQueries({ queryKey: ['posts'] });
            queryClient.invalidateQueries({ queryKey: ['user-posts'] });
            safeGoBack('/home');
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete post');
          }
        },
      },
    ]);
  };

  const isMyPost = post && (post.author_id || post.author?.id || post.author?._id) === (user?.id || (user as any)?._id);

  const authorAvatar = getAvatarSource(post?.author?.avatar);
  const userAvatar = getAvatarSource(user?.avatar);

  if (postLoading) {
    return (
      <View style={[ps.container, { paddingTop: insets.top }]}>
        <View style={[ps.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => safeGoBack('/home')} style={ps.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={ps.headerTitle}>Post</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </View>
    );
  }

  // Show error state
  if (error || fetchError || !post) {
    const errorMessage = error || (fetchError as any)?.message || 'Post not found';
    return (
      <View style={[ps.container, { paddingTop: insets.top }]}>
        <View style={[ps.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => safeGoBack('/home')} style={ps.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={ps.headerTitle}>Post</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }}>
          <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.2)" />
          <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 12, fontSize: 15, textAlign: 'center' }}>
            {errorMessage}
          </Text>
          <TouchableOpacity 
            style={{ marginTop: 20, backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}
            onPress={() => refetchPost()}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={ps.container}>
      {/* Header */}
      <View style={[ps.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => safeGoBack('/home')} style={ps.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={ps.headerTitle}>Post</Text>
        {isMyPost ? (
          <TouchableOpacity onPress={handleDeletePost} style={ps.backBtn}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setShowReportModal(true)} style={ps.backBtn}>
            <Ionicons name="flag-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ padding: 16 }}>
            {/* Author */}
            <TouchableOpacity
              style={ps.authorRow}
              activeOpacity={0.7}
              onPress={() => {
                const authorId = post.author_id || post.author?.id || post.author?._id;
                if (authorId) router.push(`/(modals)/user-profile?userId=${authorId}` as any);
              }}
            >
              {authorAvatar ? (
                <Image 
                  source={authorAvatar} 
                  style={ps.authorAvatar} 
                  resizeMode="cover"
                  fadeDuration={0} // Disable fade animation on Android
                />
              ) : (
                <View style={[ps.authorAvatar, { backgroundColor: 'rgba(99,102,241,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="person" size={20} color="rgba(255,255,255,0.5)" />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={ps.authorName}>{post.author?.display_name || post.author?.username || 'Anonymous'}</Text>
                <Text style={ps.authorDate}>{formatPostTime(post.created_at || post.createdAt)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={ps.categoryBadge}>
                  <Text style={ps.categoryText}>{post.category}</Text>
                </View>
                
                {/* Privacy indicator */}
                {post.visibility && (
                  <View style={ps.privacyBadge}>
                    <Ionicons 
                      name={
                        post.visibility === 'public' ? 'earth-outline' : 
                        post.visibility === 'followers' ? 'people-outline' : 
                        'lock-closed-outline'
                      } 
                      size={14} 
                      color="#fff" 
                    />
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Title */}
            {post.title ? <Text style={ps.title}>{post.title}</Text> : null}

            {/* Content */}
            <Text style={ps.content}>{post.content}</Text>

            {/* Images */}
            {(post.images?.length ?? 0) > 0 && (
              <View style={{ marginBottom: 14 }}>
                {post.images.map((img: string, index: number) => (
                  <AutoImage
                    key={index}
                    uri={img}
                    borderRadius={14}
                    marginBottom={8}
                  />
                ))}
              </View>
            )}

            {/* Tags */}
            {(post.tags?.length ?? 0) > 0 && (
              <View style={ps.tagRow}>
                {post.tags.map((tag: string) => (
                  <View key={tag} style={ps.tag}>
                    <Text style={ps.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Actions */}
            <View style={ps.actionRow}>
              <TouchableOpacity onPress={handleLike} style={ps.actionBtn}>
                <Ionicons name={post.liked_by_me ? 'heart' : 'heart-outline'} size={22} color="#ec4899" />
                <Text style={ps.actionText}>{post.like_count ?? post.likeCount ?? 0}</Text>
              </TouchableOpacity>
              <View style={ps.actionBtn}>
                <Ionicons name="chatbubble-outline" size={22} color="rgba(255,255,255,0.5)" />
                <Text style={ps.actionText}>{comments.length}</Text>
              </View>
              <TouchableOpacity style={ps.actionBtn} onPress={() => setShowShareModal(true)}>
                <Ionicons name="paper-plane-outline" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
              {post.author_id && post.author_id !== user?.id && (
                <BlockButton 
                  targetUserId={post.author_id} 
                  onBlockChange={(isBlocked) => {
                    // Optionally update UI based on block status change
                  }}
                />
              )}
            </View>
          </View>

          {/* Comments Section */}
          <View style={ps.commentsSection}>
            <Text style={ps.commentsTitle}>Comments ({comments.length})</Text>
            {comments.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="chatbubbles-outline" size={44} color="rgba(255,255,255,0.12)" />
                <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 8, fontSize: 14 }}>
                  {post.commentsEnabled !== false ? 'No comments yet' : 'Comments are disabled'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 2 }}>
                  {post.commentsEnabled !== false ? 'Be the first to comment!' : 'The creator has disabled comments'}
                </Text>
              </View>
            ) : (
              comments.map((comment: any) => {
                const cAvatar = getAvatarSource(comment.author?.avatar);
                return (
                  <View key={comment._id || comment.id} style={ps.commentItem}>
                    {cAvatar ? (
                      <Image source={cAvatar} style={ps.commentAvatar} />
                    ) : (
                      <View style={[ps.commentAvatar, { backgroundColor: 'rgba(99,102,241,0.2)', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="person" size={14} color="rgba(255,255,255,0.4)" />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <Text style={ps.commentName}>{comment.author?.username || 'User'}</Text>
                        <Text style={ps.commentDate}>{formatPostTime(comment.created_at || comment.createdAt)}</Text>
                      </View>
                      <Text style={ps.commentContent}>{comment.content}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
        
        {/* Comment Input - only show if comments are enabled */}
        {post.commentsEnabled !== false && (
          <View style={[ps.inputBar, { paddingBottom: insets.bottom + 8 }]}>
            {userAvatar ? (
              <Image source={userAvatar} style={ps.inputAvatar} />
            ) : (
              <View style={[ps.inputAvatar, { backgroundColor: 'rgba(99,102,241,0.2)', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={14} color="rgba(255,255,255,0.4)" />
              </View>
            )}
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Write a comment..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={ps.inputField}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              onPress={handleComment}
              disabled={loading || !commentText.trim()}
              style={[ps.sendBtn, commentText.trim() ? ps.sendBtnActive : {}]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color={commentText.trim() ? '#fff' : 'rgba(255,255,255,0.3)'} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="post"
        targetId={id}
        targetName={post?.title || 'Post'}
      />

      {/* Share Post Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <TouchableOpacity
          style={ps.shareOverlay}
          activeOpacity={1}
          onPress={() => setShowShareModal(false)}
        >
          <View style={ps.shareModal} onStartShouldSetResponder={() => true}>
            <Text style={ps.shareTitle}>Share Post</Text>
            <Text style={ps.shareSubtitle}>Send this post to a friend via DM</Text>

            {post && (
              <View style={ps.sharePreview}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
                  {post.title || post.content?.slice(0, 40) || 'Post'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                  by {post.author?.display_name || post.author?.username || 'Unknown'}
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
                      style={ps.shareFriendRow}
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
              onPress={() => setShowShareModal(false)}
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

const ps = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(15,15,30,0.95)' },
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

  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  authorAvatar: { width: 44, height: 44, borderRadius: 22 },
  authorName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  authorDate: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  categoryBadge: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  privacyBadge: {
    backgroundColor: 'rgba(255,149,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  categoryText: { color: '#818cf8', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  title: { color: '#fff', fontWeight: '800', fontSize: 22, marginBottom: 8 },
  content: { color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 22, marginBottom: 14 },
  postImage: { width: '100%', height: 200, borderRadius: 14, marginBottom: 8 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tag: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagText: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  commentsSection: {
    paddingHorizontal: 16,
    paddingTop: 18,
    borderTopWidth: 6,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  commentsTitle: { color: '#fff', fontWeight: '700', fontSize: 17, marginBottom: 14 },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  commentAvatar: { width: 34, height: 34, borderRadius: 17 },
  commentName: { color: '#fff', fontWeight: '600', fontSize: 13 },
  commentDate: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  commentContent: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 19 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(20,20,40,0.95)',
    gap: 10,
  },
  inputAvatar: { width: 34, height: 34, borderRadius: 17 },
  inputField: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 14,
    maxHeight: 80,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: { backgroundColor: '#6366f1' },

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
});