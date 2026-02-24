import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { postService } from '@/services/postService';
import { uploadImage } from '@/services/uploadService';
import { useAuthStore } from '@/store/authStore';
import { POST_CATEGORIES } from '@/constants/anime';
import { safeGoBack } from '@/utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ── Avatar helpers ── */
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

const MAX_IMAGES = 10;

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('discussion');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  // Privacy controls
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'selected'>('public');
  const [commentsEnabled, setCommentsEnabled] = useState(true);

  const contentRef = useRef<TextInput>(null);
  const avatarSrc = getAvatarSource(user?.avatar);
  const selectedCat = POST_CATEGORIES.find((c) => c.value === category);
  const canPost = content.trim().length > 0;

  /* ── Image picker ── */
  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limit reached', `You can add up to ${MAX_IMAGES} images`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to add images');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES));
    }
  };

  const takePhoto = async () => {
    if (images.length >= MAX_IMAGES) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take photos');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setImages((prev) => [...prev, result.assets[0].uri].slice(0, MAX_IMAGES));
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ── Tags ── */
  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (t && !tags.includes(t) && tags.length < 20) {
      setTags((prev) => [...prev, t]);
      setTagInput('');
    }
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  /* ── Submit ── */
  const handleCreate = async () => {
    if (!canPost) return;
    setLoading(true);
    try {
      // Upload images to storage first, then use the public URLs
      let uploadedImageUrls: string[] = [];
      if (images.length > 0) {
        console.log('[CreatePost] Uploading', images.length, 'image(s)...');
        uploadedImageUrls = await Promise.all(
          images.map((uri) => uploadImage(uri))
        );
        console.log('[CreatePost] Upload results:', uploadedImageUrls);
        // Validate all URLs are actual remote URLs, not local file URIs
        const valid = uploadedImageUrls.every(
          (url) => url && url.startsWith('http')
        );
        if (!valid) {
          throw new Error('One or more images failed to upload properly');
        }
      }

      await postService.createPost({
        title: title.trim() || undefined,
        content: content.trim(),
        category,
        tags,
        images: uploadedImageUrls,
        visibility,
        commentsEnabled,
      });
      Alert.alert('Posted! 🎉', 'Your post is now live.', [
        { text: 'OK', onPress: () => safeGoBack('/home') },
      ]);
    } catch (error: any) {
      console.error('[CreatePost] Error:', error);
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  /* ── Render ── */
  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      {/* ─ Header ─ */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => safeGoBack('/home')} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>New Post</Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={!canPost || loading}
          style={[st.shareBtn, canPost && !loading && st.shareBtnActive]}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[st.shareText, canPost && st.shareTextActive]}>Share</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─ Author row (like IG) ─ */}
          <View style={st.authorRow}>
            {avatarSrc ? (
              <Image source={avatarSrc} style={st.avatar} />
            ) : (
              <View style={[st.avatar, st.avatarPlaceholder]}>
                <Ionicons name="person" size={18} color="rgba(255,255,255,0.4)" />
              </View>
            )}
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={st.authorName}>
                {user?.displayName || user?.username || 'You'}
              </Text>
              {/* Category chip */}
              <TouchableOpacity
                onPress={() => setShowCategoryPicker((p) => !p)}
                style={st.categoryChip}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={(selectedCat?.icon as any) || 'chatbubble-outline'}
                  size={13}
                  color="#818cf8"
                />
                <Text style={st.categoryChipText}>{selectedCat?.label || 'Discussion'}</Text>
                <Ionicons name="chevron-down" size={13} color="#818cf8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ─ Category Picker (expandable) ─ */}
          {showCategoryPicker && (
            <View style={st.categoryGrid}>
              {POST_CATEGORIES.map((cat) => {
                const active = category === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[st.catItem, active && st.catItemActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setCategory(cat.value);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={18}
                      color={active ? '#fff' : 'rgba(255,255,255,0.5)'}
                    />
                    <Text style={[st.catLabel, active && st.catLabelActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ─ Title input ─ */}
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Add a headline…"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={st.titleInput}
            maxLength={200}
            returnKeyType="next"
            onSubmitEditing={() => contentRef.current?.focus()}
          />

          {/* ─ Content input (auto-growing) ─ */}
          <TextInput
            ref={contentRef}
            value={content}
            onChangeText={setContent}
            placeholder="What's on your mind?"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={st.contentInput}
            multiline
            textAlignVertical="top"
            maxLength={5000}
          />

          {/* ─ Character count ─ */}
          <View style={st.charRow}>
            <Text style={st.charCount}>
              {content.length > 0 ? `${content.length}/5000` : ''}
            </Text>
          </View>

          {/* ─ Image gallery ─ */}
          {images.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 8 }}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            >
              {images.map((uri, idx) => (
                <View key={idx} style={st.imgThumbWrap}>
                  <Image source={{ uri }} style={st.imgThumb} />
                  <TouchableOpacity
                    style={st.imgRemove}
                    onPress={() => removeImage(idx)}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={22} color="#fff" />
                  </TouchableOpacity>
                  {images.length > 1 && (
                    <View style={st.imgIndex}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                        {idx + 1}
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              {/* Add more */}
              {images.length < MAX_IMAGES && (
                <TouchableOpacity style={st.imgAddMore} onPress={pickImage} activeOpacity={0.7}>
                  <Ionicons name="add" size={28} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {/* ─ Tags ─ */}
          {tags.length > 0 && (
            <View style={st.tagsWrap}>
              {tags.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={st.tagChip}
                  onPress={() => removeTag(t)}
                  activeOpacity={0.7}
                >
                  <Text style={st.tagChipText}>#{t}</Text>
                  <Ionicons name="close" size={12} color="rgba(255,255,255,0.35)" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ─ Divider ─ */}
          <View style={st.divider} />

          {/* ─ Toolbar / Attachments row (Instagram-style) ─ */}
          <View style={st.toolbar}>
            <TouchableOpacity style={st.toolBtn} onPress={pickImage} activeOpacity={0.7}>
              <Ionicons name="images-outline" size={24} color="#22c55e" />
              <Text style={st.toolLabel}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={st.toolBtn} onPress={takePhoto} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={24} color="#3b82f6" />
              <Text style={st.toolLabel}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={st.toolBtn}
              activeOpacity={0.7}
              onPress={() => {
                if (tagInput === '' && tags.length === 0) setTagInput('#');
              }}
            >
              <Ionicons name="pricetag-outline" size={22} color="#f59e0b" />
              <Text style={st.toolLabel}>Tags</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={st.toolBtn}
              onPress={() => setShowCategoryPicker((p) => !p)}
              activeOpacity={0.7}
            >
              <Ionicons name="grid-outline" size={22} color="#ec4899" />
              <Text style={st.toolLabel}>Category</Text>
            </TouchableOpacity>
          </View>

          {/* ─ Tag input row ─ */}
          <View style={st.tagInputRow}>
            <Ionicons name="pricetag-outline" size={18} color="rgba(255,255,255,0.3)" />
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add tags (press enter)…"
              placeholderTextColor="rgba(255,255,255,0.2)"
              style={st.tagInputField}
              onSubmitEditing={addTag}
              returnKeyType="done"
              blurOnSubmit={false}
            />
            {tagInput.trim().length > 0 && (
              <TouchableOpacity onPress={addTag} style={st.tagAddBtn}>
                <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 13 }}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ─ Audience section ─ */}
          <TouchableOpacity 
            style={st.optionRow}
            onPress={() => {
              Alert.alert(
                'Audience',
                'Who can see this post?',
                [
                  { text: 'Public', onPress: () => setVisibility('public') },
                  { text: 'Followers only', onPress: () => setVisibility('followers') },
                  { text: 'Selected people', onPress: () => setVisibility('selected') },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}
          >
            <Ionicons 
              name={
                visibility === 'public' ? 'earth-outline' : 
                visibility === 'followers' ? 'people-outline' : 
                'lock-closed-outline'
              } 
              size={22} 
              color="rgba(255,255,255,0.5)" 
            />
            <Text style={st.optionText}>
              {visibility === 'public' ? 'Everyone can see this post' : 
               visibility === 'followers' ? 'Only followers can see this post' : 
               'Only selected people can see this post'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={st.optionRow}
            onPress={() => setCommentsEnabled(!commentsEnabled)}
          >
            <Ionicons 
              name={commentsEnabled ? 'chatbubble-ellipses-outline' : 'chatbubble-outline'} 
              size={22} 
              color="rgba(255,255,255,0.5)" 
            />
            <Text style={st.optionText}>
              {commentsEnabled ? 'Comments are on' : 'Comments are off'}
            </Text>
            <Ionicons 
              name={commentsEnabled ? 'toggle' : 'toggle-outline'} 
              size={24} 
              color={commentsEnabled ? '#6366f1' : 'rgba(255,255,255,0.1)'} 
            />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ── Styles ── */
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a14' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { color: '#fff', fontWeight: '800', fontSize: 17 },
  shareBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  shareBtnActive: { backgroundColor: '#6366f1' },
  shareText: { color: 'rgba(255,255,255,0.3)', fontWeight: '700', fontSize: 14 },
  shareTextActive: { color: '#fff' },

  /* Author */
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarPlaceholder: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: 'rgba(99,102,241,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryChipText: { color: '#818cf8', fontSize: 12, fontWeight: '600' },

  /* Category picker grid */
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  catItemActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  catLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  catLabelActive: { color: '#fff' },

  /* Title */
  titleInput: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },

  /* Content */
  contentInput: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 23,
    paddingHorizontal: 16,
    paddingTop: 8,
    minHeight: 120,
  },
  charRow: { paddingHorizontal: 16, alignItems: 'flex-end' },
  charCount: { color: 'rgba(255,255,255,0.2)', fontSize: 12 },

  /* Images */
  imgThumbWrap: { position: 'relative' },
  imgThumb: { width: 160, height: 200, borderRadius: 14 },
  imgRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 11,
  },
  imgIndex: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgAddMore: {
    width: 80,
    height: 200,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Tags */
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tagChipText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '500' },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16,
    marginTop: 16,
  },

  /* Toolbar */
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  toolBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    gap: 4,
  },
  toolLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },

  /* Tag input */
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    gap: 10,
  },
  tagInputField: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 4,
  },
  tagAddBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(99,102,241,0.12)',
  },

  /* Option rows */
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  optionText: { flex: 1, color: 'rgba(255,255,255,0.55)', fontSize: 14 },
});