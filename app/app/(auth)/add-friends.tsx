import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { recommendationService } from '@/services/recommendationService';
import { friendService } from '@/services/friendService';

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

interface FriendSuggestion {
  id: string;
  _id?: string;
  username: string;
  avatar: string;
  bio: string;
  display_name?: string;
  is_online?: boolean;
  favorite_anime?: string[];
}

export default function AddFriendsScreen() {
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const { user } = useAuthStore();

  useEffect(() => {
    loadFriendSuggestions();
  }, []);

  const loadFriendSuggestions = async () => {
    try {
      const users = await recommendationService.getRecommendedUsers(10);
      setSuggestions(users as any);
    } catch (error) {
      console.error('Error loading friend suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (userId: string) => {
    try {
      await friendService.sendRequest(userId);
      setSentIds(prev => new Set(prev).add(userId));
    } catch (error) {
      console.error('Error adding friend:', error);
    }
  };

  const handleSkip = () => {
    // Navigate to the main home screen after completing onboarding
    router.replace('/home');
  };

  const renderFriendSuggestion = ({ item }: { item: FriendSuggestion }) => {
    const userId = item._id || item.id;
    const avatarSrc = getAvatarSource(item.avatar);
    const isSent = sentIds.has(userId);

    return (
      <View style={styles.friendCard}>
        <View style={styles.friendInfo}>
          {avatarSrc ? (
            <Image source={avatarSrc} style={styles.friendAvatar} />
          ) : (
            <View style={[styles.friendAvatar, { backgroundColor: 'rgba(99,102,241,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="person" size={22} color="rgba(255,255,255,0.5)" />
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{(item as any).display_name || item.username}</Text>
            {item.bio ? (
              <Text style={styles.userBio} numberOfLines={2}>{item.bio}</Text>
            ) : null}
            {(item as any).favorite_anime?.length > 0 && (
              <View style={styles.chipRow}>
                {(item as any).favorite_anime.slice(0, 2).map((anime: string) => (
                  <View key={anime} style={styles.animeChip}>
                    <Text style={styles.animeChipText}>{anime}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
        {isSent ? (
          <View style={styles.sentButton}>
            <Ionicons name="time-outline" size={18} color="#f59e0b" />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddFriend(userId)}
          >
            <Ionicons name="person-add" size={20} color="#6366f1" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0f0f1e', '#1a1a2e']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Add Friends</Text>
          <View style={{ width: 24 }} /> {/* Spacer */}
        </View>

        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Connect with other anime fans to share recommendations and join discussions
          </Text>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>Friend Suggestions</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="refresh" size={32} color="#6366f1" style={styles.loadingSpinner} />
            </View>
          ) : suggestions.length > 0 ? (
            <FlatList
              data={suggestions}
              renderItem={renderFriendSuggestion}
              keyExtractor={(item) => item._id || item.id}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#6b6b70" />
              <Text style={styles.emptyTitle}>No suggestions right now</Text>
              <Text style={styles.emptySubtitle}>
                Check back later for more friend suggestions
              </Text>
            </View>
          )}
        </View>

        {/* Skip button at the bottom */}
        {suggestions.length === 0 && (
          <View style={styles.bottomSkipContainer}>
            <TouchableOpacity
              style={styles.primarySkipButton}
              onPress={handleSkip}
            >
              <Text style={styles.primarySkipButtonText}>Continue to App</Text>
            </TouchableOpacity>
          </View>
        )}
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    color: '#8b8b8f',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  skipButton: {
    padding: 8,
  },
  skipButtonText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  friendInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userBio: {
    color: '#8b8b8f',
    fontSize: 14,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  animeChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  animeChipText: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '600',
  },
  mutualServers: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '500',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sentButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSpinner: {
    transform: [{ rotate: '0deg' }],
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8b8b8f',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  bottomSkipContainer: {
    padding: 20,
    alignItems: 'center',
  },
  primarySkipButton: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  primarySkipButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});