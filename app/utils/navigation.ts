import { router } from 'expo-router';
import { safeGoBack as trackedSafeGoBack, canGoBack } from '@/hooks/navigationHistory';

/**
 * Safely navigate back, with fallback to a default route if no history exists
 */
export const safeGoBack = (fallbackRoute?: string) => {
  trackedSafeGoBack(fallbackRoute);
};

/**
 * Check if navigation back is possible
 */
export const canNavigateBack = (): boolean => {
  return canGoBack();
};

/**
 * Navigate to a specific route with error handling
 */
export const safeNavigate = (route: string) => {
  try {
    router.push(route);
  } catch (error) {
    console.error('Navigation failed:', error);
  }
};

/**
 * Replace current route with error handling
 */
export const safeReplace = (route: string) => {
  try {
    router.replace(route);
  } catch (error) {
    console.error('Route replacement failed:', error);
  }
};