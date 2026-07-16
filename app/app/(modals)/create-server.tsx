import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { serverService } from '@/services/serverService';
import { authService } from '@/services/authService';
import { friendService } from '@/services/friendService';
import { useAuthStore } from '@/store/authStore';
import { ANIME_GENRES, INTERESTS } from '@/constants/anime';
import { safeGoBack } from '@/utils/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/services/uploadService';

const TEMPLATES = [
  { key: 'anime-club', icon: 'tv-outline' as const, label: 'Anime Club', desc: 'Discuss your favourite anime with fans', tags: ['action', 'adventure'] },
  { key: 'manga-readers', icon: 'book-outline' as const, label: 'Manga Readers', desc: 'A community of manga enthusiasts', tags: ['manga'] },
  { key: 'gaming', icon: 'game-controller-outline' as const, label: 'Gaming', desc: 'Game together with your crew', tags: ['gaming'] },
  { key: 'art', icon: 'brush-outline' as const, label: 'Fan Art & Cosplay', desc: 'Share fan art, cosplay photos & more', tags: ['art', 'cosplay'] },
  { key: 'custom', icon: 'add-circle-outline' as const, label: 'Custom', desc: 'Start from scratch', tags: [] },
];

type Step = 'template' | 'details' | 'members' | 'customize';

export default function CreateServerScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { setUser, user } = useAuthStore();

  const friendCount = user?.friends?.length ?? 0;
  const hasEnoughFriends = friendCount >= 2;
  const [showFriendsGate, setShowFriendsGate] = useState(false);

  const [step, setStep] = useState<Step>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [animeTheme, setAnimeTheme] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [serverIconUri, setServerIconUri] = useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  // Fetch friends list for the Add Members step
  const { data: friendsList = [], isLoading: loadingFriends } = useQuery({
    queryKey: ['friends-for-server'],
    queryFn: friendService.getFriends,
    enabled: step === 'members',
  });

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const goToStep = (next: Step) => animateTransition(() => setStep(next));

  const pickServerIcon = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to pick a server icon.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setServerIconUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Image picker error:', err);
    }
  };

  const handleTemplateSelect = (key: string) => {
    // Gate: need 2+ friends
    if (!hasEnoughFriends) {
      setShowFriendsGate(true);
      return;
    }
    setSelectedTemplate(key);
    const tpl = TEMPLATES.find(t => t.key === key);
    if (tpl && key !== 'custom') {
      setSelectedTags(tpl.tags);
      setName(`My ${tpl.label} Server`);
      setDescription(tpl.desc);
    }
    goToStep('details');
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a server name');
      return;
    }
    setLoading(true);
    try {
      let iconUrl: string | undefined;
      if (serverIconUri) {
        setUploadingIcon(true);
        try {
          iconUrl = await uploadImage(serverIconUri);
        } catch (uploadErr: any) {
          console.error('Icon upload failed:', uploadErr);
          // Ask user if they want to continue without icon
          setUploadingIcon(false);
          setLoading(false);
          Alert.alert(
            'Icon Upload Failed',
            `Could not upload the server icon: ${uploadErr?.message || 'Unknown error'}.\n\nWould you like to create the server without a custom icon?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Continue Without Icon',
                onPress: () => {
                  setServerIconUri(null);
                  // Re-trigger create without icon
                  setTimeout(() => handleCreate(), 100);
                },
              },
            ]
          );
          return;
        } finally {
          setUploadingIcon(false);
        }
      }

      const server = await serverService.createServer({
        name: name.trim(),
        description: description.trim() || undefined,
        animeTheme: animeTheme.trim() || undefined,
        tags: selectedTags,
        isPublic,
        memberIds: selectedMembers,
        ...(iconUrl ? { icon: iconUrl } : {}),
      });

      // Refresh user to update servers list
      try {
        const freshUser = await authService.getCurrentUser();
        setUser(freshUser);
      } catch {}

      queryClient.invalidateQueries({ queryKey: ['servers'] });

      Alert.alert('Server Created!', `"${name.trim()}" is ready to go.`, [
        {
          text: 'Open Server',
          onPress: () => {
            safeGoBack();
            setTimeout(() => {
              router.push(`/(modals)/server/${server._id || (server as any).id}` as any);
            }, 300);
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create server');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 1: Template Selection ── */
  const renderTemplateStep = () => (
    <View style={{ flex: 1 }}>
      <Text style={st.stepTitle}>Create Your Server</Text>
      <Text style={st.stepSubtitle}>
        Your server is where you and your friends hang out. Pick a template or start fresh.
      </Text>

      <View style={{ marginTop: 20 }}>
        {TEMPLATES.map((tpl) => (
          <TouchableOpacity
            key={tpl.key}
            style={st.templateCard}
            activeOpacity={0.7}
            onPress={() => handleTemplateSelect(tpl.key)}
          >
            <View style={st.templateIcon}>
              <Ionicons name={tpl.icon} size={24} color="#818cf8" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={st.templateLabel}>{tpl.label}</Text>
              <Text style={st.templateDesc}>{tpl.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.25)" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  /* ── Step 2: Details ── */
  const renderDetailsStep = () => (
    <View style={{ flex: 1 }}>
      <Text style={st.stepTitle}>Customize Your Server</Text>
      <Text style={st.stepSubtitle}>
        Give your server a name and description so people know what it's about.
      </Text>

      {/* Server Icon Preview */}
      <View style={{ alignItems: 'center', marginVertical: 20 }}>
        <TouchableOpacity onPress={pickServerIcon} activeOpacity={0.7} style={st.iconPreview}>
          {serverIconUri ? (
            <Image source={{ uri: serverIconUri }} style={{ width: '100%', height: '100%', borderRadius: 40 }} />
          ) : (
            <Text style={st.iconPreviewText}>
              {name.trim() ? name.trim().charAt(0).toUpperCase() : '?'}
            </Text>
          )}
          <View style={st.iconEditBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={st.iconHint}>{serverIconUri ? 'Tap to change' : 'Tap to add icon'}</Text>
      </View>

      {/* Server Name */}
      <Text style={st.label}>SERVER NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Anime Hub"
        placeholderTextColor="rgba(255,255,255,0.25)"
        style={st.input}
        maxLength={100}
        autoFocus
      />

      {/* Description */}
      <Text style={[st.label, { marginTop: 18 }]}>DESCRIPTION</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Tell people what your server is about..."
        placeholderTextColor="rgba(255,255,255,0.25)"
        style={[st.input, { height: 90, textAlignVertical: 'top', paddingTop: 14 }]}
        multiline
        maxLength={500}
      />

      {/* Anime Theme */}
      <Text style={[st.label, { marginTop: 18 }]}>ANIME THEME (OPTIONAL)</Text>
      <TextInput
        value={animeTheme}
        onChangeText={setAnimeTheme}
        placeholder="e.g. One Piece, Naruto, Jujutsu Kaisen"
        placeholderTextColor="rgba(255,255,255,0.25)"
        style={st.input}
      />

      {/* Next Button */}
      <TouchableOpacity
        style={[st.primaryBtn, !name.trim() && st.primaryBtnDisabled]}
        onPress={() => goToStep('members')}
        disabled={!name.trim()}
        activeOpacity={0.7}
      >
        <Text style={st.primaryBtnText}>Next</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    </View>
  );

  /* ── Step 3: Add Members ── */
  const toggleMember = (friendId: string) => {
    setSelectedMembers(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  const renderMembersStep = () => (
    <View style={{ flex: 1 }}>
      <Text style={st.stepTitle}>Add Members</Text>
      <Text style={st.stepSubtitle}>
        Select at least 2 friends to add to your server. You can always add more later.
      </Text>

      <View style={st.memberCountRow}>
        <Ionicons name="people" size={18} color={selectedMembers.length >= 2 ? '#22c55e' : '#f97316'} />
        <Text style={[st.memberCountText, selectedMembers.length >= 2 && { color: '#22c55e' }]}>
          {selectedMembers.length} selected {selectedMembers.length < 2 ? `(need ${2 - selectedMembers.length} more)` : '✓'}
        </Text>
      </View>

      {loadingFriends ? (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <ActivityIndicator color="#6366f1" />
          <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 10, fontSize: 13 }}>Loading friends…</Text>
        </View>
      ) : (
        <View style={{ marginTop: 8 }}>
          {friendsList.map((friend: any) => {
            const fId = friend.id || friend._id;
            const isSelected = selectedMembers.includes(fId);
            const avatar = friend.avatar;
            return (
              <TouchableOpacity
                key={fId}
                style={[st.memberRow, isSelected && st.memberRowActive]}
                activeOpacity={0.7}
                onPress={() => toggleMember(fId)}
              >
                {avatar ? (
                  <Image source={{ uri: avatar }} style={st.memberAvatar} />
                ) : (
                  <View style={[st.memberAvatar, { backgroundColor: 'rgba(99,102,241,0.2)', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="person" size={18} color="rgba(255,255,255,0.5)" />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={st.memberName}>{friend.display_name || friend.username}</Text>
                  <Text style={st.memberUsername}>@{friend.username}</Text>
                </View>
                <View style={[st.memberCheck, isSelected && st.memberCheckActive]}>
                  {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Next Button */}
      <TouchableOpacity
        style={[st.primaryBtn, selectedMembers.length < 2 && st.primaryBtnDisabled]}
        onPress={() => goToStep('customize')}
        disabled={selectedMembers.length < 2}
        activeOpacity={0.7}
      >
        <Text style={st.primaryBtnText}>Next</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    </View>
  );

  /* ── Step 4: Customize ── */
  const renderCustomizeStep = () => (
    <View style={{ flex: 1 }}>
      <Text style={st.stepTitle}>Final Touches</Text>
      <Text style={st.stepSubtitle}>
        Pick tags and set your server's privacy.
      </Text>

      {/* Privacy Toggle */}
      <Text style={[st.label, { marginTop: 8 }]}>PRIVACY</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 22 }}>
        <TouchableOpacity
          style={[st.privacyCard, isPublic && st.privacyCardActive]}
          onPress={() => setIsPublic(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="globe-outline" size={28} color={isPublic ? '#818cf8' : 'rgba(255,255,255,0.4)'} />
          <Text style={[st.privacyTitle, isPublic && { color: '#818cf8' }]}>Public</Text>
          <Text style={st.privacyDesc}>Anyone can find and join</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.privacyCard, !isPublic && st.privacyCardActive]}
          onPress={() => setIsPublic(false)}
          activeOpacity={0.7}
        >
          <Ionicons name="lock-closed-outline" size={28} color={!isPublic ? '#818cf8' : 'rgba(255,255,255,0.4)'} />
          <Text style={[st.privacyTitle, !isPublic && { color: '#818cf8' }]}>Private</Text>
          <Text style={st.privacyDesc}>Invite only access</Text>
        </TouchableOpacity>
      </View>

      {/* Genre Tags */}
      <Text style={st.label}>GENRE TAGS</Text>
      <Text style={st.smallHint}>Select genres that match your server</Text>
      <View style={st.tagsWrap}>
        {ANIME_GENRES.map((tag) => (
          <TouchableOpacity
            key={tag}
            style={[st.tag, selectedTags.includes(tag) && st.tagActive]}
            onPress={() => toggleTag(tag)}
            activeOpacity={0.7}
          >
            <Text style={[st.tagText, selectedTags.includes(tag) && st.tagTextActive]}>
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Interest Tags */}
      <Text style={[st.label, { marginTop: 16 }]}>INTEREST TAGS</Text>
      <View style={st.tagsWrap}>
        {INTERESTS.map((tag) => (
          <TouchableOpacity
            key={tag}
            style={[st.tag, selectedTags.includes(tag) && st.tagActive]}
            onPress={() => toggleTag(tag)}
            activeOpacity={0.7}
          >
            <Text style={[st.tagText, selectedTags.includes(tag) && st.tagTextActive]}>
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Create Button */}
      <TouchableOpacity
        style={[st.createBtn, loading && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <Text style={st.createBtnText}>Creating…</Text>
        ) : (
          <>
            <Ionicons name="rocket-outline" size={20} color="#fff" />
            <Text style={st.createBtnText}>Create Server</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  /* ── Progress Indicator ── */
  const steps: Step[] = ['template', 'details', 'members', 'customize'];
  const currentIdx = steps.indexOf(step);

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      {/* Friends Gate Modal */}
      <Modal
        visible={showFriendsGate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFriendsGate(false)}
      >
        <View style={st.modalOverlay}>
          <View style={st.modalBox}>
            <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>👥</Text>
            <Text style={st.modalTitle}>Minimum 2 Friends Required</Text>
            <Text style={st.modalDesc}>
              You need at least 2 friends to create a server. Start connecting with other anime fans first!
            </Text>
            <Text style={st.modalCount}>
              Current friends: {friendCount}
            </Text>
            <TouchableOpacity
              style={st.modalBtn}
              onPress={() => setShowFriendsGate(false)}
            >
              <Text style={st.modalBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity
          style={st.backBtn}
          onPress={() => {
            if (step === 'template') {
              safeGoBack('/(modals)/messages');
            } else if (step === 'details') {
              goToStep('template');
            } else if (step === 'members') {
              goToStep('details');
            } else {
              goToStep('members');
            }
          }}
        >
          <Ionicons name={step === 'template' ? 'close' : 'arrow-back'} size={22} color="#fff" />
        </TouchableOpacity>

        {/* Step Indicator */}
        <View style={st.stepIndicator}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[
                st.stepDot,
                i <= currentIdx && st.stepDotActive,
              ]}
            />
          ))}
        </View>

        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {step === 'template' && renderTemplateStep()}
            {step === 'details' && renderDetailsStep()}
            {step === 'members' && renderMembersStep()}
            {step === 'customize' && renderCustomizeStep()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  stepIndicator: { flexDirection: 'row', gap: 6 },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stepDotActive: { backgroundColor: '#818cf8', width: 22 },

  stepTitle: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 16 },
  stepSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6, lineHeight: 20 },

  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(129,140,248,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  templateDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },

  iconPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#818cf8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconPreviewText: { color: '#fff', fontSize: 36, fontWeight: '700' },
  iconEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
  iconHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 8 },

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

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#818cf8',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 28,
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  privacyCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  privacyCardActive: {
    borderColor: '#818cf8',
    backgroundColor: 'rgba(129,140,248,0.08)',
  },
  privacyTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginTop: 8 },
  privacyDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4, textAlign: 'center' },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tagActive: { backgroundColor: 'rgba(129,140,248,0.18)', borderColor: '#818cf8' },
  tagText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textTransform: 'capitalize' },
  tagTextActive: { color: '#818cf8', fontWeight: '600' },

  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 28,
    gap: 8,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.2)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalDesc: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  modalCount: {
    color: '#818cf8',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 20,
  },
  modalBtn: {
    backgroundColor: '#818cf8',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 12,
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  /* ─── Add Members step ─── */
  memberCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  memberCountText: {
    color: '#f97316',
    fontSize: 14,
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  memberRowActive: {
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderColor: 'rgba(99,102,241,0.25)',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  memberUsername: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginTop: 2,
  },
  memberCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCheckActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
});