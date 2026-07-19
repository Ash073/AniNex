import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import Loader from '@/components/Loader';

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user?.onboardingCompleted && user?.profileCompleted) {
      router.replace('/home');
    } else if (isAuthenticated && user?.onboardingCompleted && !user?.profileCompleted) {
      router.replace('/profile-setup');
    } else if (isAuthenticated && !user?.onboardingCompleted) {
      router.replace('/onboarding');
    } else {
      // Not authenticated → landing / welcome page
      router.replace('/welcome');
    }
  }, [isAuthenticated, isLoading, user]);

  // Return loader while the redirect effect is processing
  return <Loader />;
}
