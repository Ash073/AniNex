import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StyleSheet, ScrollView, Modal, ActivityIndicator, Image } from 'react-native';
import { router, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
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

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Validation states
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const { setUser, setTokens, setLoading, isLoading } = useAuthStore();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const handleDiscordSignUp = async () => {
    setDiscordLoading(true);
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
    } catch (error) {
      console.error('Discord sign-up error:', error);
      Alert.alert('Error', 'Discord sign-up failed');
      setLoading(false);
    } finally {
      setDiscordLoading(false);
    }
  };

  // Warm up the browser for Android Custom Tabs (faster open)
  useEffect(() => {
    if (Platform.OS === 'android') {
      WebBrowser.warmUpAsync();
      return () => { WebBrowser.coolDownAsync(); };
    }
  }, []);

  /** Process the deep-link URL returned by the backend after OAuth */
  const handleOAuthResult = async (url: string) => {
    const params = parseQueryParams(url);
    if (!params.token) {
      setLoading(false);
      return;
    }

    try {
      const user = normalizeUser(JSON.parse(decodeURIComponent(params.user)));
      setUser(user);
      await setTokens(params.token, params.refreshToken);
      // Keep loader visible until the new screen fully mounts
      router.replace(user.onboardingCompleted ? '/home' : '/onboarding');
    } catch (error: any) {
      console.error('OAuth result error:', error);
      Alert.alert('Error', 'Sign-up failed. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    try {
      const platform = Platform.OS === 'web' ? 'web' : 'mobile';

      if (Platform.OS === 'web') {
        window.location.href = `${OAUTH_BASE}/google?platform=web`;
        return;
      }

      const redirectUrl = Linking.createURL('oauth');
      const oauthUrl = `${OAUTH_BASE}/google?platform=${platform}&redirect_uri=${encodeURIComponent(redirectUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        await handleOAuthResult(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Google sign-up error:', error);
      Alert.alert('Error', 'Google sign-up failed');
      setLoading(false);
    }
  };

  const handleFacebookSignUp = async () => {
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
      console.error('Facebook sign-up error:', error);
      Alert.alert('Error', 'Facebook sign-up failed');
      setLoading(false);
    }
  };

  // Check username availability
  useEffect(() => {
    const checkUsername = async () => {
      if (username.length < 3) {
        setUsernameError('');
        return;
      }

      // Reject if it still contains a space (should never happen with our handler,
      // but catch it just in case)
      if (/\s/.test(username)) {
        setUsernameError('Username cannot contain spaces — use _ instead');
        return;
      }

      setCheckingUsername(true);
      try {
        const response = await api.post('/auth/check-username', { username });
        if (!response.data.available) {
          setUsernameError('Username unavailable');
        } else {
          setUsernameError('');
        }
      } catch (error) {
        setUsernameError('');
      } finally {
        setCheckingUsername(false);
      }
    };

    const timer = setTimeout(checkUsername, 500);
    return () => clearTimeout(timer);
  }, [username]);

  /** Sanitise username input: spaces → underscore, strip other invalid chars */
  const handleUsernameChange = (text: string) => {
    // Replace any space with underscore, then keep only a-z A-Z 0-9 . _
    const sanitised = text
      .replace(/ /g, '_')
      .replace(/[^a-zA-Z0-9._]/g, '');
    setUsername(sanitised);
  };

  // Check email availability
  useEffect(() => {
    const checkEmail = async () => {
      if (!email.includes('@') || !email.includes('.')) {
        setEmailError('');
        return;
      }

      setCheckingEmail(true);
      try {
        const response = await api.post('/auth/check-email', { email });
        if (!response.data.available) {
          setEmailError('Email already registered');
        } else {
          setEmailError('');
        }
      } catch (error) {
        setEmailError('');
      } finally {
        setCheckingEmail(false);
      }
    };

    const timer = setTimeout(checkEmail, 500);
    return () => clearTimeout(timer);
  }, [email]);

  const handleRegister = async () => {
    console.log('🔘 Register button pressed');
    if (!username || !email || !password || !confirmPassword) {
      console.warn('⚠️ Missing fields');
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (usernameError) {
      Alert.alert('Error', usernameError);
      return;
    }

    // Extra guard — reject if there's a space character in the username
    if (/\s/.test(username)) {
      Alert.alert('Invalid Username', 'Username cannot contain spaces. Use underscore (_) instead.');
      return;
    }

    if (emailError) {
      Alert.alert('Error', emailError);
      return;
    }

    if (password.length < 6) {
      console.warn('⚠️ Password too short');
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      console.warn('⚠️ Passwords do not match');
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!agreeTerms) {
      console.warn('⚠️ Terms not agreed');
      Alert.alert('Error', 'Please agree to the terms and conditions');
      return;
    }

    setLoading(true);
    try {
      console.log('📡 Sending register request...');
      const response = await authService.register(username, email, password);
      console.log('📦 Register response:', response);

      setUser(response.user);
      await setTokens(response.token, response.refreshToken);

      // Show success modal, then navigate — loader stays visible throughout
      setShowSuccess(true);
      setTimeout(() => {
        console.log('✅ Registration complete, navigating to onboarding');
        router.replace('/onboarding');
      }, 2000);
    } catch (error: any) {
      console.error('❌ Register error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Registration failed');
      setLoading(false); // Only reset on failure so user can retry
    }
  };

  const getPasswordStrength = () => {
    if (!password) return { text: '', color: '#6b6b70', width: 0 };
    if (password.length < 6) return { text: 'Weak', color: '#ef4444', width: 33 };
    if (password.length < 10) return { text: 'Medium', color: '#f59e0b', width: 66 };
    return { text: 'Strong', color: '#22c55e', width: 100 };
  };

  const isUsernameValid = username.length >= 3 && !usernameError;
  const isEmailValid = email.includes('@') && email.includes('.') && !emailError;
  const passwordStrength = getPasswordStrength();

  // Show full-screen branded loader while registration is in progress
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
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the ultimate anime community</Text>
          </View>

          {/* Form */}
          <View style={styles.formSection}>
            <View style={[styles.inputContainer, focusedInput === 'username' && styles.inputFocused, usernameError && styles.inputError]}>
              <Ionicons name="person-outline" size={20} color={focusedInput === 'username' ? '#6366f1' : '#6b6b70'} />
              <TextInput
                placeholder="Username (e.g. anime_fan)"
                placeholderTextColor="#6b6b70"
                value={username}
                onChangeText={handleUsernameChange}
                onFocus={() => setFocusedInput('username')}
                onBlur={() => setFocusedInput(null)}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
              {checkingUsername ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : isUsernameValid ? (
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
              ) : usernameError ? (
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              ) : null}
            </View>
            {/* Hint shown only when the field is focused and nothing typed yet */}
            {focusedInput === 'username' && username.length === 0 && (
              <Text style={styles.hintText}>💡 Use underscore (_) instead of spaces</Text>
            )}
            {usernameError ? (
              <Text style={styles.errorText}>❌ {usernameError}</Text>
            ) : isUsernameValid ? (
              <Text style={styles.successText}>✅ Username available</Text>
            ) : null}

            <View style={[styles.inputContainer, focusedInput === 'email' && styles.inputFocused, emailError && styles.inputError]}>
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
              {checkingEmail ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : isEmailValid ? (
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
              ) : emailError ? (
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              ) : null}
            </View>
            {emailError ? (
              <Text style={styles.errorText}>❌ {emailError}</Text>
            ) : isEmailValid ? (
              <Text style={styles.successText}>✅ Email available</Text>
            ) : null}

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

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBarBg}>
                  <View style={[styles.strengthBar, { width: `${passwordStrength.width}%`, backgroundColor: passwordStrength.color }]} />
                </View>
                <Text style={[styles.strengthText, { color: passwordStrength.color }]}>{passwordStrength.text}</Text>
              </View>
            )}

            <View style={[styles.inputContainer, focusedInput === 'confirmPassword' && styles.inputFocused]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={focusedInput === 'confirmPassword' ? '#6366f1' : '#6b6b70'} />
              <TextInput
                placeholder="Confirm password"
                placeholderTextColor="#6b6b70"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setFocusedInput('confirmPassword')}
                onBlur={() => setFocusedInput(null)}
                style={styles.input}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6b6b70" />
              </TouchableOpacity>
            </View>

            {/* Terms Checkbox */}
            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => setAgreeTerms(!agreeTerms)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                {agreeTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRegister}
              disabled={isLoading}
              style={[styles.signUpButton, isLoading && styles.buttonDisabled]}
              activeOpacity={0.8}
            >
              <Text style={styles.signUpButtonText}>Create Account</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign up with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialButtons}>
              <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignUp} disabled={googleLoading} activeOpacity={0.7}>
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="logo-google" size={22} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} onPress={handleDiscordSignUp} disabled={discordLoading} activeOpacity={0.7}>
                {discordLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="logo-discord" size={22} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} onPress={handleFacebookSignUp} disabled={facebookLoading} activeOpacity={0.7}>
                {facebookLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="logo-facebook" size={22} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
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
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: 50,
    right: -150,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  bgCircle3: {
    position: 'absolute',
    top: '50%' as any,
    left: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
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
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 12,
    outlineStyle: 'none',
  } as any,
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: -8,
    paddingHorizontal: 4,
  },
  strengthBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginRight: 12,
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '500',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#8b8b8f',
    lineHeight: 20,
  },
  termsLink: {
    color: '#6366f1',
    fontWeight: '500',
  },
  signUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 18,
    borderRadius: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
  successText: {
    color: '#22c55e',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
  hintText: {
    color: '#6b6b70',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#6b6b70',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 15,
    color: '#8b8b8f',
  },
  footerLink: {
    fontSize: 15,
    color: '#6366f1',
    fontWeight: '600',
  },
});
