import { useState, useRef, useMemo } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { userService } from '@/services/userService';
import { authService } from '@/services/authService';
import { uploadImage } from '@/services/uploadService';
import { safeGoBack } from '@/utils/navigation';
import { ANIME_GENRES, INTERESTS } from '@/constants/anime';

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

const LOCAL_AVATAR_KEYS = Object.keys(LOCAL_AVATARS);

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

const GENDERS = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName || user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(user?.genres || []);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user?.interests || []);
  const [favoriteAnime, setFavoriteAnime] = useState<string[]>(user?.favoriteAnime || user?.favorite_anime || []);
  const [animeInput, setAnimeInput] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Snapshot of initial values for change detection
  const initialValues = useMemo(() => ({
    displayName: user?.displayName || user?.display_name || '',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
    gender: user?.gender || '',
    mobile: user?.mobile || '',
    genres: JSON.stringify(user?.genres || []),
    interests: JSON.stringify(user?.interests || []),
    favoriteAnime: JSON.stringify(user?.favoriteAnime || user?.favorite_anime || []),
  }), []);

  const hasChanges = () => {
    return (
      displayName.trim() !== initialValues.displayName ||
      bio.trim() !== initialValues.bio ||
      avatar !== initialValues.avatar ||
      gender !== initialValues.gender ||
      mobile.trim() !== initialValues.mobile ||
      JSON.stringify(selectedGenres) !== initialValues.genres ||
      JSON.stringify(selectedInterests) !== initialValues.interests ||
      JSON.stringify(favoriteAnime) !== initialValues.favoriteAnime
    );
  };

  const avatarSrc = getAvatarSource(avatar);

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setAvatar('gallery:' + result.assets[0].uri);
      setShowAvatarPicker(false);
    }
  };

  const toggleGenre = (g: string) =>
    setSelectedGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const toggleInterest = (i: string) =>
    setSelectedInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const addAnime = () => {
    const t = animeInput.trim();
    if (t && !favoriteAnime.includes(t)) {
      setFavoriteAnime((prev) => [...prev, t]);
      setAnimeInput('');
    }
  };

  const removeAnime = (a: string) => setFavoriteAnime((prev) => prev.filter((x) => x !== a));

  const handleSave = async () => {
    // If nothing changed, just go back
    if (!hasChanges()) {
      safeGoBack('/profile');
      return;
    }

    setLoading(true);
    try {
      // If avatar is a gallery pick (temp file), upload to Supabase for a permanent URL
      let finalAvatar = avatar;
      if (avatar.startsWith('gallery:')) {
        try {
          const fileUri = avatar.replace('gallery:', '');
          const uploadedUrl = await uploadImage(fileUri);
          finalAvatar = uploadedUrl;
          setAvatar(finalAvatar);
        } catch (uploadErr) {
          console.warn('Avatar upload failed, keeping existing');
        }
      }

      await userService.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatar: finalAvatar,
        gender,
        mobile: mobile.trim(),
        genres: selectedGenres,
        interests: selectedInterests,
        favoriteAnime,
      });
      // Refresh user data
      try {
        const freshUser = await authService.getCurrentUser();
        setUser(freshUser);
      } catch {}
      Alert.alert('Changes saved!', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => safeGoBack('/profile') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => safeGoBack('/profile')} hitSlop={12}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          style={[st.saveBtn, !loading && st.saveBtnActive]}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={st.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 24 }}>
            <TouchableOpacity onPress={() => setShowAvatarPicker((p) => !p)} activeOpacity={0.8}>
              {avatarSrc ? (
                <Image 
                  source={avatarSrc} 
                  style={st.bigAvatar} 
                  resizeMode="cover"
                  fadeDuration={0} // Disable fade animation on Android
                />
              ) : (
                <View style={[st.bigAvatar, st.avatarPlaceholder]}>
                  <Ionicons name="person" size={36} color="rgba(255,255,255,0.4)" />
                </View>
              )}
              <View style={st.cameraIcon}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={st.avatarHint}>Tap to change avatar</Text>
          </View>

          {/* Avatar Picker */}
          {showAvatarPicker && (
            <View style={st.avatarGrid}>
              {LOCAL_AVATAR_KEYS.map((key) => {
                const isActive = avatar === `local:${key}` || avatar === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      setAvatar(`local:${key}`);
                      setShowAvatarPicker(false);
                    }}
                    style={[st.avatarOption, isActive && st.avatarOptionActive]}
                  >
                    <Image source={LOCAL_AVATARS[key]} style={st.avatarOptionImg} />
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={pickFromGallery}
                style={[st.avatarOption, { borderStyle: 'dashed' }]}
              >
                <Ionicons name="image-outline" size={24} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
          )}

          {/* Display Name */}
          <Text style={st.label}>DISPLAY NAME</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={st.input}
            maxLength={50}
          />

          {/* Bio */}
          <Text style={[st.label, { marginTop: 18 }]}>BIO</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell something about yourself..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={[st.input, { height: 90, textAlignVertical: 'top', paddingTop: 14 }]}
            multiline
            maxLength={500}
          />
          <Text style={st.charCount}>{bio.length}/500</Text>

          {/* Gender */}
          <Text style={[st.label, { marginTop: 18 }]}>GENDER</Text>
          <TouchableOpacity
            style={st.dropdown}
            onPress={() => setShowGenderPicker((p) => !p)}
            activeOpacity={0.7}
          >
            <Text style={{ color: gender ? '#fff' : 'rgba(255,255,255,0.25)', fontSize: 15 }}>
              {gender || 'Select gender'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>
          {showGenderPicker && (
            <View style={st.genderOptions}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[st.genderOption, gender === g && st.genderOptionActive]}
                  onPress={() => {
                    setGender(g);
                    setShowGenderPicker(false);
                  }}
                >
                  <Text style={[st.genderOptionText, gender === g && { color: '#818cf8' }]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Mobile */}
          <Text style={[st.label, { marginTop: 18 }]}>MOBILE (OPTIONAL)</Text>
          <TextInput
            value={mobile}
            onChangeText={setMobile}
            placeholder="+91 XXXXXXXXXX"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={st.input}
            keyboardType="phone-pad"
          />

          {/* Favorite Anime */}
          <Text style={[st.label, { marginTop: 24 }]}>FAVORITE ANIME</Text>
          {favoriteAnime.length > 0 && (
            <View style={st.chipRow}>
              {favoriteAnime.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={st.chipRemovable}
                  onPress={() => removeAnime(a)}
                  activeOpacity={0.7}
                >
                  <Text style={st.chipRemovableText}>{a}</Text>
                  <Ionicons name="close" size={12} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={st.addRow}>
            <TextInput
              value={animeInput}
              onChangeText={setAnimeInput}
              placeholder="Add anime title…"
              placeholderTextColor="rgba(255,255,255,0.2)"
              style={st.addInput}
              onSubmitEditing={addAnime}
              returnKeyType="done"
              blurOnSubmit={false}
            />
            {animeInput.trim().length > 0 && (
              <TouchableOpacity onPress={addAnime} style={st.addBtn}>
                <Text style={{ color: '#818cf8', fontWeight: '700', fontSize: 13 }}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Genres */}
          <Text style={[st.label, { marginTop: 24 }]}>GENRES</Text>
          <Text style={st.smallHint}>Select your favorite genres</Text>
          <View style={st.chipRow}>
            {ANIME_GENRES.map((g) => (
              <TouchableOpacity
                key={g}
                style={[st.chip, selectedGenres.includes(g) && st.chipActive]}
                onPress={() => toggleGenre(g)}
                activeOpacity={0.7}
              >
                <Text style={[st.chipText, selectedGenres.includes(g) && st.chipTextActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Interests */}
          <Text style={[st.label, { marginTop: 24 }]}>INTERESTS</Text>
          <Text style={st.smallHint}>What do you enjoy?</Text>
          <View style={st.chipRow}>
            {INTERESTS.map((i) => (
              <TouchableOpacity
                key={i}
                style={[st.chip, selectedInterests.includes(i) && st.chipActive]}
                onPress={() => toggleInterest(i)}
                activeOpacity={0.7}
              >
                <Text style={[st.chipText, selectedInterests.includes(i) && st.chipTextActive]}>
                  {i}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a14' },
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
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  saveBtnActive: { backgroundColor: '#6366f1' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  bigAvatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0a0a14',
  },
  avatarHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 8 },

  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
    justifyContent: 'center',
  },
  avatarOption: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarOptionActive: { borderColor: '#6366f1', borderWidth: 3 },
  avatarOptionImg: { width: 54, height: 54, borderRadius: 27 },

  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  smallHint: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 10, marginTop: -4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  charCount: { color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'right', marginTop: 4 },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  genderOptions: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  genderOption: { paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  genderOptionActive: { backgroundColor: 'rgba(99,102,241,0.1)' },
  genderOptionText: { color: 'rgba(255,255,255,0.6)', fontSize: 15 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: 'rgba(129,140,248,0.18)', borderColor: '#818cf8' },
  chipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textTransform: 'capitalize' },
  chipTextActive: { color: '#818cf8', fontWeight: '600' },

  chipRemovable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99,102,241,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  chipRemovableText: { color: '#818cf8', fontSize: 13, fontWeight: '600' },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
});
