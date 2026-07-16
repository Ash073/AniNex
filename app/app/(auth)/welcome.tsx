import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  console.log('WelcomeScreen rendering');

  const handleGetStarted = () => {
    console.log('Get Started pressed');
    router.push('/register');
  };

  const handleSignIn = () => {
    console.log('Sign In pressed');
    router.push('/login');
  };

  return (
    <View style={styles.container}>
      {/* Background Decoration */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <View style={styles.bgCircle3} />
      <View style={styles.bgCircle4} />

      {/* Floating Icons */}
      <View style={[styles.floatingIcon, { top: '15%', left: '10%' }]}>
        <Ionicons name="heart" size={24} color="rgba(236, 72, 153, 0.6)" />
      </View>
      <View style={[styles.floatingIcon, { top: '20%', right: '15%' }]}>
        <Ionicons name="star" size={20} color="rgba(251, 191, 36, 0.6)" />
      </View>
      <View style={[styles.floatingIcon, { bottom: '25%', left: '15%' }]}>
        <Ionicons name="chatbubble" size={22} color="rgba(99, 102, 241, 0.6)" />
      </View>
      <View style={[styles.floatingIcon, { bottom: '30%', right: '10%' }]}>
        <Ionicons name="play" size={26} color="rgba(34, 197, 94, 0.6)" />
      </View>

      <View style={styles.content}>
        {/* Logo above AniNex title */}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Image
            source={require('../../assets/logo/AniNex (1).png')}
            style={{ width: 180, height: 180, marginBottom: 12 }}
            resizeMode="contain"
          />
        </View>

        {/* Brand */}
        <Text style={styles.title}>AniNex</Text>
        <Text style={styles.subtitle}>
          Your ultimate anime community
        </Text>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="people" size={18} color="#6366f1" />
            </View>
            <Text style={styles.featureText}>Join Communities</Text>
          </View>
          <View style={styles.featureDot} />
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="chatbubbles" size={18} color="#6366f1" />
            </View>
            <Text style={styles.featureText}>Real-time Chat</Text>
          </View>
          <View style={styles.featureDot} />
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="heart" size={18} color="#6366f1" />
            </View>
            <Text style={styles.featureText}>Share Moments</Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.8}
          onPress={handleGetStarted}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.8}
          onPress={handleSignIn}
        >
          <Text style={styles.secondaryButtonText}>I already have an account</Text>
        </TouchableOpacity>

        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink}>Terms</Text> and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0a0a14',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    display: 'flex',
  },
  bgCircle1: {
    position: 'absolute',
    top: -150,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: -100,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
  },
  bgCircle3: {
    position: 'absolute',
    top: '30%' as any,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  bgCircle4: {
    position: 'absolute',
    bottom: '30%' as any,
    right: -60,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
  },
  floatingIcon: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    marginBottom: 60,
    width: '100%',
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  logoInner: {
    width: 120,
    height: 120,
    borderRadius: 36,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  logoGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 46,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    zIndex: 1,
  },
  title: {
    fontFamily: 'Oswald_700Bold',
    fontSize: 52,
    color: '#ffffff',
    marginBottom: 12,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    color: '#8b8b8f',
    textAlign: 'center',
    width: '100%',
    marginBottom: 32,
  },
  features: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginHorizontal: -4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 13,
    color: '#a1a1a5',
    fontWeight: '500',
  },
  featureDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 8,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    marginTop: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: '100%',

  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 17,
  },
  secondaryButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 16,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 17,
  },
  termsText: {
    fontSize: 13,
    color: '#6b6b70',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  termsLink: {
    color: '#6366f1',
  },
});
