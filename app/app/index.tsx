import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import Loader from '@/components/Loader';
import { useAnimatedStyle } from 'react-native-reanimated';

// Preview of the implementation logic
export default function Index() {
  const animatedTextSegment = useAnimatedStyle(() => {
    return {
      width: expandProgress.value * expansionWidth,
      opacity: expandProgress.value,
    };
  });
  const { isAuthenticated, isLoading, user } = useAuthStore();

  // Still loading tokens / user from storage
  if (isLoading) {
    return <Loader />;
  }

  // Fully authenticated and set-up → go to home
  if (isAuthenticated && user?.onboardingCompleted && user?.profileCompleted) {
    return <Redirect href="/home" />;
  }

  // Authenticated but onboarding/profile incomplete
  if (isAuthenticated && user?.onboardingCompleted && !user?.profileCompleted) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  if (isAuthenticated && !user?.onboardingCompleted) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  // Not authenticated → landing / welcome page
  return <Redirect href="/welcome" />;
}
