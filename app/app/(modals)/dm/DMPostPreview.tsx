import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { postService } from '@/services/postService';
import { Post } from '@/types';

interface DMPostPreviewProps {
  postId: string;
  createdAt?: string;
  isOwn?: boolean;
  avatarSrc?: any;
  handleLongPress?: (item: any) => void;
  item?: any;
}

// Avatar helpers (consistent with other screens)
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

const styles = StyleSheet.create({
  container: {
    width: 260,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#6366f1',
  },
  authorName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0f0f1e',
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  viewOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  footer: {
    padding: 14,
    backgroundColor: '#1a1a2e',
  },
  postTitle: {
    color: '#6366f1',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  postContent: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 19,
  },
  timeLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    marginTop: 10,
    alignSelf: 'flex-end',
    fontStyle: 'italic',
  },
  loadingContainer: {
    width: 260,
    height: 320,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.1)',
  }
});

const DMPostPreview: React.FC<DMPostPreviewProps> = ({
  postId,
  createdAt,
  handleLongPress,
  item
}) => {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (postId) {
      setLoading(true);
      postService.getPost(postId)
        .then((data) => {
          setPost(data);
        })
        .catch(() => {
          setPost(null);
        })
        .finally(() => setLoading(false));
    }
  }, [postId]);

  const handlePress = () => {
    if (postId) {
      router.push(`/(modals)/post/${postId}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  if (!post) return null;

  const avatarSrc = getAvatarSource(post.author?.avatar);
  const username = post.author?.username || post.author?.display_name || 'Anonymous';

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handlePress}
      onLongPress={() => handleLongPress?.(item || post)}
      style={styles.container}
    >
      {/* IG style header */}
      <View style={styles.header}>
        {avatarSrc ? (
          <Image source={avatarSrc} style={styles.authorAvatar} />
        ) : (
          <View style={[styles.authorAvatar, { backgroundColor: '#444', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="person" size={14} color="#888" />
          </View>
        )}
        <Text style={styles.authorName} numberOfLines={1}>
          {username}
        </Text>
      </View>

      {/* Main Image */}
      <View style={styles.imageContainer}>
        {post.images && post.images.length > 0 ? (
          <Image
            source={{ uri: post.images[0] }}
            style={styles.postImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.postImage, { justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="image-outline" size={40} color="rgba(255,255,255,0.1)" />
          </View>
        )}
        <View style={styles.viewOverlay}>
          <Ionicons name="eye" size={12} color="#fff" />
          <Text style={styles.viewText}>VIEW POST</Text>
        </View>
      </View>

      {/* Footer / Captions */}
      <View style={styles.footer}>
        {post.title && (
          <Text style={styles.postTitle} numberOfLines={1}>
            {post.title}
          </Text>
        )}
        <Text style={styles.postContent} numberOfLines={2}>
          <Text style={{ fontWeight: '800', color: '#fff' }}>{username} </Text>
          {post.content || ''}
        </Text>

        {createdAt && (
          <Text style={styles.timeLabel}>
            {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default DMPostPreview;
