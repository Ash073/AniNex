import { useEffect } from 'react';
import { useNavigation, NavigationProp, CommonActions } from '@react-navigation/native';
import { router, useGlobalSearchParams } from 'expo-router';

// Global state to track navigation history
let navigationHistory: string[] = [];
let canGoBackCache = false;

export const updateNavigationHistory = (routeName: string) => {
  // Add route to history if it's not already the last item
  if (navigationHistory[navigationHistory.length - 1] !== routeName) {
    navigationHistory.push(routeName);
  }
  // Update the cache
  canGoBackCache = navigationHistory.length > 1;
};

export const canGoBack = (): boolean => {
  return canGoBackCache && navigationHistory.length > 1;
};

export const safeGoBack = (fallbackRoute?: string) => {
  if (canGoBack()) {
    // Remove the current route from history
    navigationHistory.pop();
    // Update cache
    canGoBackCache = navigationHistory.length > 1;
    // Perform actual navigation
    router.back();
  } else {
    // Navigate to fallback or home
    const route = fallbackRoute || '/home';
    router.replace(route);
    // Reset history to just the new route
    navigationHistory = [route];
    canGoBackCache = false;
  }
};

export const resetNavigationHistory = () => {
  navigationHistory = [];
  canGoBackCache = false;
};

// Custom hook to track navigation
export const useNavigationTracking = (routeName: string) => {
  useEffect(() => {
    updateNavigationHistory(routeName);
    
    // Clean up on unmount
    return () => {
      // Optionally remove from history when component unmounts
      // This is more complex and may not be necessary depending on navigation patterns
    };
  }, [routeName]);
};

// Hook to expose navigation state
export const useNavigationState = () => {
  return {
    canGoBack: canGoBack(),
    historyLength: navigationHistory.length,
    currentRoute: navigationHistory[navigationHistory.length - 1],
    goBack: safeGoBack,
  };
};