import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet, Animated, ImageBackground, Image } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { ANIME_GENRES, INTERESTS, EXPERIENCE_LEVELS } from '@/constants/anime';
import { safeGoBack } from '@/utils/navigation';

const POPULAR_ANIME = [
  { name: 'One Piece', icon: 'skull', color: '#FF6B6B' },
  { name: 'Naruto', icon: 'flash', color: '#FFB347' },
  { name: 'Attack on Titan', icon: 'shield', color: '#4ECDC4' },
  { name: 'My Hero Academia', icon: 'star', color: '#95E1D3' },
  { name: 'Demon Slayer', icon: 'flame', color: '#F38181' },
  { name: 'Jujutsu Kaisen', icon: 'nuclear', color: '#AA96DA' },
  { name: 'Death Note', icon: 'book', color: '#FCBAD3' },
  { name: 'Fullmetal Alchemist', icon: 'flask', color: '#FFFFD2' },
  { name: 'Hunter x Hunter', icon: 'fish', color: '#6BCB77' },
  { name: 'Tokyo Ghoul', icon: 'eye', color: '#E84545' },
  { name: 'Vinland Saga', icon: 'boat', color: '#5D9CEC' },
  { name: 'Dandadan', icon: 'flash', color: '#FC6E51' }
];

// Extended list of anime for suggestions
const ANIME_SUGGESTIONS = [
  'Sword Art Online', 'Re:Zero', 'Spy x Family', 'Chainsaw Man', 'Bleach',
  'Dragon Ball Z', 'Dragon Ball Super', 'Mob Psycho 100', 'One Punch Man',
  'Neon Genesis Evangelion', 'Code Geass', 'Fairy Tail', 'Black Clover',
  'Blue Lock', 'Haikyuu', 'Kuroko no Basket', 'Slam Dunk', 'Prince of Tennis',
  'Parasyte', 'Akame ga Kill', 'Kill la Kill', 'Gurren Lagann', 'Trigun',
  'Berserk', 'Claymore', 'Hellsing', 'Hellsing Ultimate', 'Psycho-Pass',
  'Monster', 'Erased', 'The Promised Neverland', 'Made in Abyss', 'Dororo',
  'Samurai Champloo', 'Rurouni Kenshin', 'Gintama', 'Grand Blue', 'Konosuba',
  'Overlord', 'That Time I Got Reincarnated as a Slime', 'Mushoku Tensei',
  'Solo Leveling', 'Tower of God', 'The God of High School', 'Noblesse',
  'Bocchi the Rock', 'Oshi no Ko', 'Frieren', 'Dungeon Meshi', 'Kaiju No. 8',
  'Jojo\'s Bizarre Adventure', 'Fire Force', 'Dr. Stone', 'Horimiya',
  'Toradora', 'Clannad', 'Your Lie in April', 'Anohana', 'Violet Evergarden',
  'A Silent Voice', 'Your Name', 'Weathering with You', 'Suzume', 'Spirited Away',
  'Howl\'s Moving Castle', 'Princess Mononoke', 'My Neighbor Totoro',
  'Cyberpunk Edgerunners', 'Arcane', 'Castlevania', 'Devilman Crybaby',
  'Banana Fish', 'Given', 'Yuri on Ice', 'Free', 'Haikyu', 'Blue Exorcist',
  'Noragami', 'Bungo Stray Dogs', 'Durarara', 'Baccano', 'Black Lagoon',
  'Classroom of the Elite', 'Kaguya-sama: Love is War', 'Rent-a-Girlfriend',
  'Quintessential Quintuplets', 'Nisekoi', 'Oregairu', 'Hyouka', 'Nichijou'
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const [favoriteAnime, setFavoriteAnime] = useState<string[]>([]);
  const [customAnime, setCustomAnime] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { setUser } = useAuthStore();

  // Filter suggestions based on input (minimum 2 characters)
  const filteredSuggestions = customAnime.length >= 2
    ? ANIME_SUGGESTIONS.filter(anime =>
      anime.toLowerCase().includes(customAnime.toLowerCase()) &&
      !favoriteAnime.includes(anime) &&
      !POPULAR_ANIME.map(pa => pa.name).includes(anime)
    ).slice(0, 5)
    : [];

  const handleCustomAnimeChange = (text: string) => {
    setCustomAnime(text);
    setShowSuggestions(text.length >= 2);
  };

  const selectSuggestion = (anime: string) => {
    if (!favoriteAnime.includes(anime)) {
      setFavoriteAnime([...favoriteAnime, anime]);
    }
    setCustomAnime('');
    setShowSuggestions(false);
  };

  const toggleSelection = (item: string, list: string[], setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const addCustomAnime = () => {
    if (customAnime.trim() && !favoriteAnime.includes(customAnime.trim())) {
      setFavoriteAnime([...favoriteAnime, customAnime.trim()]);
      setCustomAnime('');
    }
  };

  const handleNext = () => {
    if (step === 1 && favoriteAnime.length === 0) {
      Alert.alert('Please select', 'Select at least one favorite anime');
      return;
    }
    if (step === 2 && genres.length === 0) {
      Alert.alert('Please select', 'Select at least one genre');
      return;
    }
    if (step === 3 && interests.length === 0) {
      Alert.alert('Please select', 'Select at least one interest');
      return;
    }
    if (step === 4 && !experienceLevel) {
      Alert.alert('Please select', 'Select your experience level');
      return;
    }

    if (step < 4) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const response = await authService.completeOnboarding({
        favoriteAnime,
        genres,
        interests,
        experienceLevel
      });
      // Ensure onboardingCompleted is set to true
      setUser({ ...response.data.user, onboardingCompleted: true });
      router.replace('/home');
    } catch (error: any) {
      console.error('Onboarding error:', error.response?.data || error.message);
      const errMsg = error.response?.data?.errors
        ? error.response.data.errors.map((e: any) => e.message).join('\n')
        : error.response?.data?.message || 'Onboarding failed';
      Alert.alert('Error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={styles.progressStepContainer}>
          <View style={[
            styles.progressCircle,
            i <= step && styles.progressCircleActive,
            i < step && styles.progressCircleCompleted
          ]}>
            {i < step ? (
              <Ionicons name="checkmark" size={16} color="#fff" />
            ) : (
              <Text style={styles.progressNumber}>{i}</Text>
            )}
          </View>
          {i < 4 && (
            <View style={[
              styles.progressLine,
              i < step && styles.progressLineActive
            ]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.stepIcon}
        >
          <Ionicons name="heart" size={32} color="#fff" />
        </LinearGradient>
        <Text style={styles.stepTitle}>Your Favorite Anime</Text>
        <Text style={styles.stepSubtitle}>Pick the shows that made you fall in love with anime ✨</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.animeGrid}>
          {POPULAR_ANIME.map((anime) => {
            const isSelected = favoriteAnime.includes(anime.name);

            return (
              <TouchableOpacity
                key={anime.name}
                onPress={() => toggleSelection(anime.name, favoriteAnime, setFavoriteAnime)}
                style={[styles.animeCard, isSelected && styles.animeCardSelected]}
                activeOpacity={0.7}
              >
                {anime.name === 'One Piece' ? (
                  <ImageBackground
                    source={require('@/assets/background/One Piece.jpg')}
                    style={styles.animeCardImageBackground}
                    imageStyle={{ borderRadius: 16, resizeMode: 'cover' }}
                  >
                    <View style={[styles.onePieceOverlay, isSelected && styles.onePieceOverlaySelected]}>
                      <Image
                        source={require('@/assets/background/one piece text.png')}
                        style={styles.onePieceLogo}
                        resizeMode="contain"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : anime.name === 'Naruto' ? (
                  <ImageBackground
                    source={require('@/assets/background/naruto.jpg')}
                    style={styles.animeCardImageBackground}
                    imageStyle={{ borderRadius: 16, resizeMode: 'cover' }}
                  >
                    <View style={[styles.animeOverlayTop, isSelected && styles.animeOverlaySelected]}>
                      <Image
                        source={require('@/assets/background/naruto-logo.png')}
                        style={styles.narutoLogo}
                        resizeMode="contain"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : anime.name === 'Attack on Titan' ? (
                  <ImageBackground
                    source={require('@/assets/background/Attack on Titan.jpg')}
                    style={styles.animeCardImageBackground}
                    imageStyle={{ borderRadius: 16, resizeMode: 'cover' }}
                  >
                    <View style={[styles.animeOverlayTop, isSelected && styles.animeOverlaySelected]}>
                      <Image
                        source={require('@/assets/background/Attack-on-Titan-Logo.png')}
                        style={styles.attackOnTitanLogo}
                        resizeMode="contain"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : anime.name === 'My Hero Academia' ? (
                  <ImageBackground
                    source={require('@/assets/background/MHA.jpg')}
                    style={styles.animeCardImageBackground}
                    imageStyle={{ borderRadius: 16, resizeMode: 'cover' }}
                  >
                    <View style={[styles.animeOverlayTop, isSelected && styles.animeOverlaySelected]}>
                      <Image
                        source={require('@/assets/background/MHA-text.png')}
                        style={styles.mhaLogo}
                        resizeMode="contain"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : anime.name === 'Demon Slayer' ? (
                  <ImageBackground
                    source={require('@/assets/background/Demon Slayer.jpg')}
                    style={styles.animeCardImageBackground}
                    imageStyle={{ borderRadius: 16, resizeMode: 'cover' }}
                  >
                    <View style={[styles.animeOverlayTop, isSelected && styles.animeOverlaySelected]}>
                      <Image
                        source={require('@/assets/background/Demon Slayer-Logo.png')}
                        style={styles.demonSlayerLogo}
                        resizeMode="contain"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : anime.name === 'Jujutsu Kaisen' ? (
                  <ImageBackground
                    source={require('@/assets/background/JJK.jpg')}
                    style={styles.animeCardImageBackground}
                    imageStyle={{ borderRadius: 16, resizeMode: 'cover' }}
                  >
                    <View style={[styles.animeOverlayTop, isSelected && styles.animeOverlaySelected]}>
                      <Image
                        source={require('@/assets/background/JJK-Logo.png')}
                        style={styles.jjkLogo}
                        resizeMode="contain"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : anime.name === 'Death Note' ? (
                  <ImageBackground
                    source={require('@/assets/background/Death Note.jpg')}
                    style={styles.animeCardImageBackground}
                    imageStyle={{ borderRadius: 16, resizeMode: 'cover' }}
                  >
                    <View style={[styles.animeOverlayTop, isSelected && styles.animeOverlaySelected]}>
                      <Image
                        source={require('@/assets/background/Death Note-Logo.png')}
                        style={styles.deathNoteLogo}
                        resizeMode="contain"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : anime.name === 'Fullmetal Alchemist' ? (
                  <ImageBackground
                    source={require('@/assets/background/Fullmetal Alchemist.jpg')}
                    style={styles.animeCardImageBackground}
                    imageStyle={{ borderRadius: 16, resizeMode: 'cover' }}
                  >
                    <View style={[styles.animeOverlayTop, isSelected && styles.animeOverlaySelected]}>
                      <Image
                        source={require('@/assets/background/Fullmetal Alchemist-Logo.png')}
                        style={styles.fullmetalAlchemistLogo}
                        resizeMode="contain"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : anime.name === 'Hunter x Hunter' ? (
                  <ImageBackground
                    source={require('@/assets/background/Hunter x Hunter.jpg')}
                    style={styles.animeCardImageBackground}
                    imageStyle={{ borderRadius: 16, resizeMode: 'cover' }}
                  >
                    <View style={[styles.animeOverlayTop, isSelected && styles.animeOverlaySelected]}>
                      <Image
                        source={require('@/assets/background/Hunter x Hunter-Logo.png')}
                        style={styles.hunterXHunterLogo}
                        resizeMode="contain"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : anime.name === 'Tokyo Ghoul' ? (
                  <ImageBackground
                    source={require('@/assets/background/Tokyo Ghoul.jpg')}
                    style={styles.animeCardImageBackground}
                    imageStyle={{ borderRadius: 16, resizeMode: 'cover' }}
                  >
                    <View style={[styles.animeOverlayTop, isSelected && styles.animeOverlaySelected]}>
                      <Image
                        source={require('@/assets/background/Ghoul Tokyo-Logo.png')}
                        style={styles.tokyoGhoulLogo}
                        resizeMode="contain"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : anime.name === 'Vinland Saga' ? (
                  <ImageBackground
                    source={require('@/assets/background/Vinland Saga.jpg')}
                    style={styles.animeCardImageBackground}
                    imageStyle={{ borderRadius: 16, resizeMode: 'cover' }}
                  >
                    <View style={[styles.animeOverlayTop, isSelected && styles.animeOverlaySelected]}>
                      <Image
                        source={require('@/assets/background/Vinland Saga-Logo.png')}
                        style={styles.vinlandSagaLogo}
                        resizeMode="contain"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : anime.name === 'Dandadan' ? (
                  <ImageBackground
                    source={require('@/assets/background/Dandadan.png')}
                    style={styles.animeCardImageBackground}
                    imageStyle={{ borderRadius: 16, resizeMode: 'cover' }}
                  >
                    <View style={[styles.animeOverlayTop, isSelected && styles.animeOverlaySelected]}>
                      <Image
                        source={require('@/assets/background/Dandadan-Logo.png')}
                        style={styles.dandadanLogo}
                        resizeMode="contain"
                      />
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : (
                  <LinearGradient
                    colors={isSelected ? [anime.color, anime.color + 'CC'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                    style={styles.animeCardGradient}
                  >
                    <Ionicons
                      name={anime.icon as any}
                      size={24}
                      color={isSelected ? '#fff' : anime.color}
                    />
                    <Text style={[styles.animeCardText, isSelected && styles.animeCardTextSelected]}>
                      {anime.name}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      </View>
                    )}
                  </LinearGradient>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.customAnimeSection}>
          <Text style={styles.sectionLabel}>
            <Ionicons name="add-circle" size={16} color="#6366f1" /> Add Your Own
          </Text>
          <View style={styles.customAnimeInput}>
            <TextInput
              placeholder="Type anime name..."
              placeholderTextColor="#6b6b70"
              value={customAnime}
              onChangeText={handleCustomAnimeChange}
              style={styles.textInput}
              onSubmitEditing={addCustomAnime}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            <TouchableOpacity
              onPress={addCustomAnime}
              style={styles.addButton}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                style={styles.addButtonGradient}
              >
                <Ionicons name="add" size={24} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Suggestions Dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {filteredSuggestions.map((anime, index) => (
                <TouchableOpacity
                  key={anime}
                  style={[
                    styles.suggestionItem,
                    index === filteredSuggestions.length - 1 && styles.suggestionItemLast
                  ]}
                  onPress={() => selectSuggestion(anime)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="tv-outline" size={16} color="#6366f1" />
                  <Text style={styles.suggestionText}>{anime}</Text>
                  <Ionicons name="add-circle-outline" size={18} color="#8b8b8f" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {favoriteAnime.filter(a => !POPULAR_ANIME.map(pa => pa.name).includes(a)).length > 0 && (
          <View style={styles.customList}>
            <Text style={styles.sectionLabel}>Your Custom Picks</Text>
            <View style={styles.customChips}>
              {favoriteAnime.filter(a => !POPULAR_ANIME.map(pa => pa.name).includes(a)).map(anime => (
                <View key={anime} style={styles.customChip}>
                  <Text style={styles.customChipText}>{anime}</Text>
                  <TouchableOpacity
                    onPress={() => setFavoriteAnime(favoriteAnime.filter(a => a !== anime))}
                    style={styles.removeButton}
                  >
                    <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#ec4899', '#f43f5e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.stepIcon}
        >
          <Ionicons name="color-palette" size={32} color="#fff" />
        </LinearGradient>
        <Text style={styles.stepTitle}>Favorite Genres</Text>
        <Text style={styles.stepSubtitle}>Tell us what type of stories captivate you 🎭</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.genreGrid}>
          {ANIME_GENRES.map(genre => {
            const isSelected = genres.includes(genre);
            return (
              <TouchableOpacity
                key={genre}
                onPress={() => toggleSelection(genre, genres, setGenres)}
                style={[styles.genreChip, isSelected && styles.genreChipSelected]}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <LinearGradient
                    colors={['#ec4899', '#f43f5e']}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
                <Text style={[styles.genreText, isSelected && styles.genreTextSelected]}>
                  {genre}
                </Text>
                {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#22c55e', '#10b981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.stepIcon}
        >
          <Ionicons name="sparkles" size={32} color="#fff" />
        </LinearGradient>
        <Text style={styles.stepTitle}>Your Interests</Text>
        <Text style={styles.stepSubtitle}>What else gets you excited? 🌟</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.genreGrid}>
          {INTERESTS.map(interest => {
            const isSelected = interests.includes(interest);
            return (
              <TouchableOpacity
                key={interest}
                onPress={() => toggleSelection(interest, interests, setInterests)}
                style={[styles.genreChip, isSelected && styles.genreChipSelected]}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <LinearGradient
                    colors={['#22c55e', '#10b981']}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
                <Text style={[styles.genreText, isSelected && styles.genreTextSelected]}>
                  {interest}
                </Text>
                {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#f59e0b', '#f97316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.stepIcon}
        >
          <Ionicons name="trophy" size={32} color="#fff" />
        </LinearGradient>
        <Text style={styles.stepTitle}>Experience Level</Text>
        <Text style={styles.stepSubtitle}>How deep are you in the anime world? 🎯</Text>
      </View>

      <View style={styles.experienceContainer}>
        {EXPERIENCE_LEVELS.map((level, index) => {
          const isSelected = experienceLevel === level.value;
          const gradientColors: readonly [string, string] =
            index === 0 ? ['#6366f1', '#8b5cf6'] :
              index === 1 ? ['#ec4899', '#f43f5e'] :
                ['#f59e0b', '#f97316'];
          return (
            <TouchableOpacity
              key={level.value}
              onPress={() => setExperienceLevel(level.value)}
              style={[styles.experienceCard, isSelected && styles.experienceCardSelected]}
              activeOpacity={0.7}
            >
              {isSelected && (
                <LinearGradient
                  colors={gradientColors}
                  style={styles.experienceCardGradient}
                />
              )}
              <View style={[styles.experienceBadge, isSelected && styles.experienceBadgeSelected]}>
                <Ionicons
                  name={index === 0 ? 'leaf' : index === 1 ? 'flame' : 'rocket'}
                  size={24}
                  color={isSelected ? '#fff' : '#6366f1'}
                />
              </View>
              <Text style={[styles.experienceTitle, isSelected && styles.experienceTitleSelected]}>
                {level.label}
              </Text>
              <Text style={[styles.experienceDesc, isSelected && styles.experienceDescSelected]}>
                {level.description}
              </Text>
              {isSelected && (
                <View style={styles.selectedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Back Button */}
      <TouchableOpacity
        style={{ position: 'absolute', top: 48, left: 20, zIndex: 30, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, padding: 8 }}
        onPress={() => safeGoBack('/welcome')}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={28} color="#1c1c1e" />
      </TouchableOpacity>
      {/* Background decoration */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <View style={styles.bgCircle3} />

      <View style={styles.safeArea}>
        {renderProgressBar()}

        <View style={styles.content}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </View>

        <View style={styles.buttonContainer}>
          {step > 1 && (
            <TouchableOpacity
              onPress={() => setStep(step - 1)}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleNext}
            disabled={loading}
            style={[styles.nextButton, step === 1 && styles.nextButtonFull]}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextButtonGradient}
            >
              <Text style={styles.nextButtonText}>
                {loading ? 'Completing...' : step === 4 ? 'Complete Setup' : 'Continue'}
              </Text>
              {!loading && <Ionicons name={step === 4 ? "checkmark" : "arrow-forward"} size={20} color="#fff" />}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a14',
  },
  bgCircle1: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: -150,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(236, 72, 153, 0.08)',
  },
  bgCircle3: {
    position: 'absolute',
    top: '40%',
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
  },
  safeArea: {
    flex: 1,
    paddingTop: 60,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  progressStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  progressCircleCompleted: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  progressNumber: {
    color: '#6b6b70',
    fontSize: 14,
    fontWeight: '600',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#6366f1',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContainer: {
    flex: 1,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#8b8b8f',
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  animeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  animeCard: {
    width: '50%',
    padding: 6,
    flexBasis: '50%',
  },
  animeCardSelected: {},
  animeCardGradient: {
    borderRadius: 16,
    padding: 16,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  animeCardImageBackground: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animeCardText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  animeCardTextSelected: {
    color: '#ffffff',
  },
  onePieceOverlay: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onePieceOverlaySelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.4)',
  },
  animeOverlay: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animeOverlayTop: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animeOverlaySelected: {
    backgroundColor: 'rgba(255, 179, 71, 0.4)',
  },
  onePieceLogo: {
    width: 150,
    height: 60,
  },
  narutoLogo: {
    width: 250,
    height: 130,
  },
  attackOnTitanLogo: {
    width: 200,
    height: 100,
  },
  mhaLogo: {
    width: 180,
    height: 80,
  },
  demonSlayerLogo: {
    width: 200,
    height: 100,
  },
  jjkLogo: {
    width: 170,
    height: 70,
  },
  deathNoteLogo: {
    width: 170,
    height: 70,
  },
  fullmetalAlchemistLogo: {
    width: 250,
    height: 130,
  },
  hunterXHunterLogo: {
    width: 200,
    height: 100,
  },
  tokyoGhoulLogo: {
    width: 170,
    height: 70,
  },
  vinlandSagaLogo: {
    width: 170,
    height: 70,
  },
  dandadanLogo: {
    width: 170,
    height: 70,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  customAnimeSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#8b8b8f',
    fontWeight: '600',
    marginBottom: 12,
  },
  customAnimeInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 12,
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: 'rgba(30, 30, 40, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customList: {
    marginTop: 16,
    marginBottom: 24,
  },
  customChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  customChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    margin: 4,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  customChipText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
  removeButton: {
    marginLeft: 4,
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  genreChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    margin: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  genreChipSelected: {
    borderColor: 'transparent',
  },
  genreText: {
    color: '#8b8b8f',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
    marginRight: 6,
  },
  genreTextSelected: {
    color: '#ffffff',
  },
  experienceContainer: {
    flex: 1,
  },
  experienceCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
  experienceCardSelected: {
    borderColor: 'transparent',
  },
  experienceCardGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  experienceBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  experienceBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  experienceTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  experienceTitleSelected: {
    color: '#ffffff',
  },
  experienceDesc: {
    fontSize: 14,
    color: '#8b8b8f',
    lineHeight: 20,
  },
  experienceDescSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  selectedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 16,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  nextButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});
