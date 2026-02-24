import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet, Image, Modal, FlatList, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { authService } from '@/services/authService';
import { uploadImage } from '@/services/uploadService';
import { useAuthStore } from '@/store/authStore';
import { User } from '@/types';
import { EXPERIENCE_LEVELS } from '@/constants/anime';
import Loader from '@/components/Loader';

const { width } = Dimensions.get('window');

// Local avatar images from assets
const AVATAR_IMAGES = [
  { id: '1', source: require('@/assets/avatar/Avatar1.png.jpeg') },
  { id: '2', source: require('@/assets/avatar/Avatar2.png.jpeg') },
  { id: '3', source: require('@/assets/avatar/Avatar3.png.jpeg') },
  { id: '4', source: require('@/assets/avatar/Avatar4.png.jpeg') },
  { id: '5', source: require('@/assets/avatar/Avatar5.png.jpeg') },
  { id: '6', source: require('@/assets/avatar/Avatar6.png.jpeg') },
  { id: '7', source: require('@/assets/avatar/Avatar7.png.jpeg') },
  { id: '8', source: require('@/assets/avatar/Avatar8.png.jpeg') },
  { id: 'r1', source: require('@/assets/avatar/Avatarr1.png') },
  { id: 'r2', source: require('@/assets/avatar/Avatarr2.png') },
  { id: 'r3', source: require('@/assets/avatar/Avatarr3.png') },
  { id: 'r4', source: require('@/assets/avatar/Avatarr4.png') },
  { id: 'r5', source: require('@/assets/avatar/Avatarr5.png') },
  { id: 'r6', source: require('@/assets/avatar/Avatarr6.png') },
  { id: 'r7', source: require('@/assets/avatar/Avatarr7.png') },
  { id: 'r8', source: require('@/assets/avatar/Avatarr8.png') },
  { id: 'r9', source: require('@/assets/avatar/Avatarr9.png') },
  { id: 'r10', source: require('@/assets/avatar/Avatarr10.png') },
];

export default function ProfileSetupScreen() {
  const { user, setUser, setLoading, isLoading } = useAuthStore();

  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [gender, setGender] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState('1');
  const [galleryImageUri, setGalleryImageUri] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const genders = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];

  const selectedAvatar = AVATAR_IMAGES.find(a => a.id === selectedAvatarId) || AVATAR_IMAGES[0];

  // Pre-fill displayName from username
  useEffect(() => {
    if (user?.username) {
      setDisplayName(user.username);
    }
  }, [user]);

  const pickImageFromGallery = async () => {
    // Request permission
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to choose a profile picture.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setGalleryImageUri(result.assets[0].uri);
      setSelectedAvatarId(''); // deselect any preset avatar
      setShowAvatarPicker(false);
    }
  };

  // Determine what image source to show for the avatar
  const currentAvatarSource = galleryImageUri
    ? { uri: galleryImageUri }
    : selectedAvatar.source;

  const experienceLabel = EXPERIENCE_LEVELS.find(e => e.value === user?.experienceLevel)?.label || user?.experienceLevel || '';

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Hold on!', 'Please enter your display name');
      return;
    }

    setLoading(true);
    try {
      // If user picked a gallery image, upload it to Supabase Storage for a permanent URL
      let avatarValue = `local:${selectedAvatarId}`;
      if (galleryImageUri) {
        try {
          const uploadedUrl = await uploadImage(galleryImageUri);
          avatarValue = uploadedUrl; // permanent HTTP URL
        } catch (uploadErr) {
          console.warn('Avatar upload failed, using local fallback');
          avatarValue = `local:${selectedAvatarId || '1'}`;
        }
      }

      const profileData: any = {
        bio: bio.trim(),
        displayName: displayName.trim(),
        avatar: avatarValue,
        profileCompleted: true,
      };
      if (age) profileData.age = parseInt(age);
      if (dob) profileData.dateOfBirth = dob;
      if (mobile.trim()) profileData.mobile = mobile.trim();
      if (gender) profileData.gender = gender;

      const response = await authService.updateProfile(profileData);
      setUser(response.user);
      // Keep loader visible until the new screen mounts
      router.push('/add-friends');
    } catch (error: any) {
      console.error('Profile update error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update profile');
      setLoading(false); // Only reset on failure so user can retry
    }
  };

  const renderAvatarPicker = () => (
    <Modal
      visible={showAvatarPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAvatarPicker(false)}
    >
      <View style={styles.avatarModalOverlay}>
        <View style={styles.avatarModalContent}>
          <View style={styles.avatarModalHeader}>
            <Text style={styles.avatarModalTitle}>Choose Your Avatar</Text>
            <TouchableOpacity onPress={() => setShowAvatarPicker(false)}>
              <Ionicons name="close-circle" size={28} color="#6b6b70" />
            </TouchableOpacity>
          </View>
          <Text style={styles.avatarModalSubtitle}>Pick a character that represents you ✨</Text>

          {/* Gallery Pick Button */}
          <TouchableOpacity style={styles.galleryPickButton} onPress={pickImageFromGallery}>
            <LinearGradient
              colors={['rgba(99, 102, 241, 0.2)', 'rgba(139, 92, 246, 0.2)']}
              style={styles.galleryPickGradient}
            >
              <Ionicons name="images-outline" size={22} color="#8b5cf6" />
              <Text style={styles.galleryPickText}>Choose from Gallery</Text>
              <Ionicons name="chevron-forward" size={18} color="#6b6b70" />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.avatarOrText}>— or pick a preset —</Text>

          <FlatList
            data={AVATAR_IMAGES}
            numColumns={4}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.avatarGridContent}
            renderItem={({ item }) => {
              const isSelected = selectedAvatarId === item.id;
              return (
                <TouchableOpacity
                  style={[styles.avatarOption, isSelected && styles.avatarOptionSelected]}
                  onPress={() => {
                    setSelectedAvatarId(item.id);
                    setGalleryImageUri(null); // clear gallery pick
                    setShowAvatarPicker(false);
                  }}
                >
                  <Image
                    source={item.source}
                    style={styles.avatarOptionImage}
                    resizeMode="cover"
                    fadeDuration={0} // Disable fade animation on Android
                  />
                  {isSelected && (
                    <View style={styles.avatarCheckBadge}>
                      <Ionicons name="checkmark-circle" size={18} color="#6366f1" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );

  const renderGenderPicker = () => (
    <Modal
      visible={showGenderPicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowGenderPicker(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        onPress={() => setShowGenderPicker(false)}
      >
        <View style={styles.genderPickerContainer}>
          <View style={styles.genderPickerHeader}>
            <Text style={styles.genderPickerTitle}>Select Gender</Text>
            <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
              <Ionicons name="close" size={24} color="#6b6b70" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={genders}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.genderOption, gender === item && styles.genderOptionActive]}
                onPress={() => {
                  setGender(item);
                  setShowGenderPicker(false);
                }}
              >
                <Text style={[styles.genderOptionText, gender === item && styles.genderOptionTextActive]}>{item}</Text>
                {gender === item && <Ionicons name="checkmark" size={20} color="#6366f1" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Show full-screen branded loader while profile is being saved
  if (isLoading) {
    return <Loader />;
  }

  return (
    <LinearGradient colors={['#0f0f1e', '#1a1a2e']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Complete Your Profile</Text>
          <TouchableOpacity onPress={() => router.push('/add-friends')}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrapper} onPress={() => setShowAvatarPicker(true)}>
              <Image source={currentAvatarSource} style={styles.avatarImage} />
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                style={styles.cameraButton}
              >
                <Ionicons name="camera" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAvatarPicker(true)}>
              <Text style={styles.changeAvatarText}>Tap to change avatar</Text>
            </TouchableOpacity>
          </View>

          {/* Onboarding Summary Card */}
          {user && (user.favoriteAnime?.length > 0 || user.genres?.length > 0 || user.interests?.length > 0) && (
            <View style={styles.summaryCard}>
              <LinearGradient
                colors={['rgba(99, 102, 241, 0.15)', 'rgba(139, 92, 246, 0.08)']}
                style={styles.summaryGradient}
              >
                <View style={styles.summaryHeader}>
                  <Ionicons name="sparkles" size={18} color="#6366f1" />
                  <Text style={styles.summaryTitle}>Your Anime Profile</Text>
                </View>

                {experienceLabel ? (
                  <View style={styles.summaryRow}>
                    <View style={styles.expBadge}>
                      <Ionicons name="trophy" size={14} color="#fbbf24" />
                      <Text style={styles.expBadgeText}>{experienceLabel}</Text>
                    </View>
                  </View>
                ) : null}

                {user.favoriteAnime?.length > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Favorites</Text>
                    <View style={styles.chipRow}>
                      {user.favoriteAnime.slice(0, 4).map((a: string) => (
                        <View key={a} style={styles.miniChip}>
                          <Text style={styles.miniChipText}>{a}</Text>
                        </View>
                      ))}
                      {user.favoriteAnime.length > 4 && (
                        <View style={[styles.miniChip, styles.miniChipMore]}>
                          <Text style={styles.miniChipText}>+{user.favoriteAnime.length - 4}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {user.genres?.length > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Genres</Text>
                    <View style={styles.chipRow}>
                      {user.genres.slice(0, 5).map((g: string) => (
                        <View key={g} style={[styles.miniChip, styles.genreMiniChip]}>
                          <Text style={styles.miniChipText}>{g}</Text>
                        </View>
                      ))}
                      {user.genres.length > 5 && (
                        <View style={[styles.miniChip, styles.miniChipMore]}>
                          <Text style={styles.miniChipText}>+{user.genres.length - 5}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {user.interests?.length > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Interests</Text>
                    <View style={styles.chipRow}>
                      {user.interests.map((i: string) => (
                        <View key={i} style={[styles.miniChip, styles.interestMiniChip]}>
                          <Text style={styles.miniChipText}>{i}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </LinearGradient>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Display Name *</Text>
              <View style={[styles.inputContainer, focusedInput === 'name' && styles.inputFocused]}>
                <Ionicons name="person-outline" size={20} color="#6b6b70" />
                <TextInput
                  placeholder="What should we call you?"
                  placeholderTextColor="#6b6b70"
                  value={displayName}
                  onChangeText={setDisplayName}
                  onFocus={() => setFocusedInput('name')}
                  onBlur={() => setFocusedInput(null)}
                  style={styles.input}
                  maxLength={50}
                />
              </View>
              <Text style={styles.inputHint}>This is what other users will see (not your username)</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bio</Text>
              <View style={[styles.textareaContainer, focusedInput === 'bio' && styles.inputFocused]}>
                <TextInput
                  placeholder="Tell the anime world about yourself... 🎌"
                  placeholderTextColor="#6b6b70"
                  value={bio}
                  onChangeText={(text) => setBio(text.slice(0, 500))}
                  onFocus={() => setFocusedInput('bio')}
                  onBlur={() => setFocusedInput(null)}
                  style={styles.textarea}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{bio.length}/500</Text>
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.halfInputGroup, { marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Age</Text>
                <View style={[styles.inputContainer, focusedInput === 'age' && styles.inputFocused]}>
                  <Ionicons name="calendar-outline" size={20} color="#6b6b70" />
                  <TextInput
                    placeholder="Age"
                    placeholderTextColor="#6b6b70"
                    value={age}
                    onChangeText={setAge}
                    onFocus={() => setFocusedInput('age')}
                    onBlur={() => setFocusedInput(null)}
                    style={styles.input}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
              </View>

              <View style={[styles.halfInputGroup, { marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>Gender</Text>
                <TouchableOpacity
                  style={[styles.inputContainer, focusedInput === 'gender' && styles.inputFocused]}
                  onPress={() => setShowGenderPicker(true)}
                >
                  <Ionicons name="male-female-outline" size={20} color="#6b6b70" />
                  <Text style={[styles.input, { color: gender ? '#fff' : '#6b6b70' }]}>
                    {gender || 'Select'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#6b6b70" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date of Birth</Text>
              <View style={[styles.inputContainer, focusedInput === 'dob' && styles.inputFocused]}>
                <Ionicons name="gift-outline" size={20} color="#6b6b70" />
                <TextInput
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#6b6b70"
                  value={dob}
                  onChangeText={setDob}
                  onFocus={() => setFocusedInput('dob')}
                  onBlur={() => setFocusedInput(null)}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={[styles.inputContainer, focusedInput === 'mobile' && styles.inputFocused]}>
                <Ionicons name="call-outline" size={20} color="#6b6b70" />
                <TextInput
                  placeholder="Enter mobile number"
                  placeholderTextColor="#6b6b70"
                  value={mobile}
                  onChangeText={setMobile}
                  onFocus={() => setFocusedInput('mobile')}
                  onBlur={() => setFocusedInput(null)}
                  style={styles.input}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Action Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleSaveProfile}
            disabled={isLoading}
            activeOpacity={0.8}
            style={{ borderRadius: 16, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.continueButton, isLoading && styles.buttonDisabled]}
            >
              <Text style={styles.continueButtonText}>Complete Setup</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {renderAvatarPicker()}
        {renderGenderPicker()}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  skipText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0f0f1e',
  },
  changeAvatarText: {
    color: '#8b8b8f',
    fontSize: 13,
    fontWeight: '500',
  },
  // Summary Card
  summaryCard: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  summaryGradient: {
    padding: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 8,
  },
  summaryRow: {
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8b8b8f',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  miniChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  genreMiniChip: {
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
  },
  interestMiniChip: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  miniChipMore: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  miniChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  expBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  expBadgeText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Form
  formContainer: {
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 18,
  },
  halfInputGroup: {
    flex: 1,
    marginBottom: 18,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ccc',
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 11,
    color: '#6b6b70',
    marginTop: 6,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  textareaContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputFocused: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    marginLeft: 10,
  },
  textarea: {
    color: '#fff',
    fontSize: 15,
    minHeight: 80,
  },
  charCount: {
    color: '#6b6b70',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  // Buttons
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(15, 15, 30, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  continueButton: {
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Avatar Picker Modal
  avatarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  avatarModalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 30,
  },
  avatarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  avatarModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  avatarModalSubtitle: {
    color: '#8b8b8f',
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  galleryPickButton: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  galleryPickGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  galleryPickText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
  },
  avatarOrText: {
    color: '#6b6b70',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  avatarGridContent: {
    paddingHorizontal: 12,
  },
  avatarOption: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    margin: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  avatarOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  avatarOptionImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarCheckBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  // Gender Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderPickerContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    width: '80%',
    maxHeight: 300,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  genderPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  genderPickerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  genderOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  genderOptionActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  genderOptionText: {
    color: '#fff',
    fontSize: 16,
  },
  genderOptionTextActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
});