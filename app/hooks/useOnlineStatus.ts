import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useNetworkStore } from '@/store/networkStore';

export function useOnlineStatus() {
  const setOffline = useNetworkStore((state) => state.setOffline);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => setOffline(false);
      const handleOffline = () => setOffline(true);

      // Initial check
      setOffline(!navigator.onLine);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [setOffline]);
}
