import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { router, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { safeGoBack } from '@/utils/navigation';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { OAUTH_BASE_URL } from '@/constants/api';
import Loader from '@/components/Loader';

// Dismiss any lingering auth session (needed for expo-web-browser on web)
WebBrowser.maybeCompleteAuthSession();

// Backend OAuth base URL — all OAuth config lives on the server
const OAUTH_BASE = OAUTH_BASE_URL;

// Helper: parse query params from a URL string
const parseQueryParams = (url: string): Record<string, string> => {
  const params: Record<string, string> = {};
  const queryString = url.includes('?') ? url.split('?')[1]?.split('#')[0] : '';
  if (!queryString) return params;
  queryString.split('&').forEach(pair => {
    const [key, val] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(val || '');
  });
  return params;
};

// Normalize snake_case user from backend into camelCase for the frontend
const normalizeUser = (raw: any) => ({
  ...raw,
  id: raw.id || raw._id,
  _id: raw.id || raw._id,
  displayName: raw.display_name || raw.displayName || '',
  favoriteAnime: raw.favorite_anime || raw.favoriteAnime || [],
  experienceLevel: raw.experience_level || raw.experienceLevel || 'casual',
  onboardingCompleted: raw.onboarding_completed ?? raw.onboardingCompleted ?? false,
  profileCompleted: raw.profile_completed ?? raw.profileCompleted ?? false,
  isOnline: raw.is_online ?? raw.isOnline ?? false,
  lastSeen: raw.last_seen || raw.lastSeen,
  dateOfBirth: raw.date_of_birth || raw.dateOfBirth,
  createdAt: raw.created_at || raw.createdAt,
  updatedAt: raw.updated_at || raw.updatedAt,
});

export default function LoginScreen() {
  // Discord OAuth
  const handleDiscordLogin = async () => {
    setLoading(true);
    try {
      const platform = Platform.OS === 'web' ? 'web' : 'mobile';
      if (Platform.OS === 'web') {
        window.location.href = `${OAUTH_BASE}/discord?platform=web`;
        return;
      }
      const redirectUrl = Linking.createURL('oauth');
      const oauthUrl = `${OAUTH_BASE}/discord?platform=${platform}&redirect_uri=${encodeURIComponent(redirectUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        await handleOAuthResult(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Discord login error:', error);
      Alert.alert('Error', 'Discord sign-in failed');
      setLoading(false);
    }
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const { setUser, setTokens, setLoading, isLoading } = useAuthStore();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);

  // Warm up the browser for Android Custom Tabs (faster open)
  useEffect(() => {
    if (Platform.OS === 'android') {
      WebBrowser.warmUpAsync();
      return () => { WebBrowser.coolDownAsync(); };
    }
  }, []);

  /** Process the deep-link URL returned by the backend after OAuth */
  const handleOAuthResult = async (url: string) => {
    console.log('[OAuth] Handling result URL:', url);
    const params = parseQueryParams(url);
    if (!params.token) {
      setLoading(false);
      return;
    }

    try {
      const user = normalizeUser(JSON.parse(decodeURIComponent(params.user)));
      setUser(user);
      await setTokens(params.token, params.refreshToken);
      // If profile not completed or username missing, redirect to profile setup
      if (!user.profileCompleted || !user.username) {
        router.replace({
          pathname: '/profile-setup',
          params: { email: user.email }, // auto-fill email
        });
      } else {
        router.replace(user.onboardingCompleted ? '/home' : '/onboarding');
      }
    } catch (error: any) {
      console.error('OAuth result error:', error);
      Alert.alert('Error', 'Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const platform = Platform.OS === 'web' ? 'web' : 'mobile';

      if (Platform.OS === 'web') {
        window.location.href = `${OAUTH_BASE}/google?platform=web`;
        return;
      }

      // Generate the correct return URL for this runtime (Expo Go vs standalone)
      const redirectUrl = Linking.createURL('oauth');
      console.log('[OAuth] Return URL:', redirectUrl);
      const oauthUrl = `${OAUTH_BASE}/google?platform=${platform}&redirect_uri=${encodeURIComponent(redirectUrl)}`;
      console.log('[OAuth] Opening Google auth:', oauthUrl);

      // Mobile: backend redirects through Google → callback → 302 deep link
      const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectUrl);
      console.log('[OAuth] Auth session result:', result.type, 'url' in result ? result.url : 'no url');
      if (result.type === 'success' && result.url) {
        await handleOAuthResult(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        console.log('[OAuth] User cancelled/dismissed');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      Alert.alert('Error', 'Google sign-in failed');
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setLoading(true);
    try {
      const platform = Platform.OS === 'web' ? 'web' : 'mobile';

      if (Platform.OS === 'web') {
        window.location.href = `${OAUTH_BASE}/facebook?platform=web`;
        return;
      }

      const redirectUrl = Linking.createURL('oauth');
      const oauthUrl = `${OAUTH_BASE}/facebook?platform=${platform}&redirect_uri=${encodeURIComponent(redirectUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        await handleOAuthResult(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Facebook login error:', error);
      Alert.alert('Error', 'Facebook sign-in failed');
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    console.log('🔘 Login button pressed');
    if (!email || !password) {
      console.warn('⚠️ Missing credentials');
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      console.log('📡 Sending login request...');
      const response = await authService.login(email, password);
      console.log('📦 Login response:', response);

      setUser(response.user);
      await setTokens(response.token, response.refreshToken);

      console.log('🎯 Navigation check - onboardingCompleted:', response.user.onboardingCompleted);
      // Keep loader visible until the new screen fully mounts
      if (response.user.onboardingCompleted) {
        router.replace('/home');
      } else {
        router.replace('/onboarding');
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Login failed');
      setLoading(false); // Only reset on failure so the user can retry
    }
  };

  // Show full-screen branded loader while login / token-refresh is in progress
  if (isLoading) {
    return <Loader />;
  }

  return (
    <View style={styles.container}>
      {/* Background Decoration */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <View style={styles.bgCircle3} />

      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => safeGoBack('/welcome')}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo/AniNex (1).png')}
              style={{ width: 140, height: 140 }}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your anime journey</Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          <View style={[styles.inputContainer, focusedInput === 'email' && styles.inputFocused]}>
            <Ionicons name="mail-outline" size={20} color={focusedInput === 'email' ? '#6366f1' : '#6b6b70'} />
            <TextInput
              placeholder="Email address"
              placeholderTextColor="#6b6b70"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.inputContainer, focusedInput === 'password' && styles.inputFocused]}>
            <Ionicons name="lock-closed-outline" size={20} color={focusedInput === 'password' ? '#6366f1' : '#6b6b70'} />
            <TextInput
              placeholder="Password"
              placeholderTextColor="#6b6b70"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              style={styles.input}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6b6b70" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            style={[styles.signInButton, isLoading && styles.buttonDisabled]}
            activeOpacity={0.8}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialButtons}>
            <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin} disabled={googleLoading} activeOpacity={0.7}>
              {googleLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="logo-google" size={22} color="#fff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={handleDiscordLogin} activeOpacity={0.7}>
              <Ionicons name="logo-discord" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={handleFacebookLogin} disabled={facebookLoading} activeOpacity={0.7}>
              {facebookLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="logo-facebook" size={22} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/register" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </KeyboardAvoidingView>
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
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: 100,
    left: -150,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
  },
  bgCircle3: {
    position: 'absolute',
    top: '40%' as any,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 150,
    height: 150,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Oswald_700Bold',
    fontSize: 32,
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8b8b8f',
    textAlign: 'center',
  },
  formSection: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputFocused: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 12,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  signInButton: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: '#6b6b70',
    fontSize: 14,
    marginHorizontal: 16,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#8b8b8f',
    fontSize: 14,
  },
  footerLink: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
});