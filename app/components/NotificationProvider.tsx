import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface NotificationPayload {
  title: string;
  body: string;
  avatar?: string;
  /** Optional callback when the toast is tapped */
  onPress?: () => void;
}

interface NotificationContextType {
  showNotification: (n: NotificationPayload) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  showNotification: () => {},
});

export const useNotification = () => useContext(NotificationContext);

const DISPLAY_MS = 3500;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [notification, setNotification] = useState<NotificationPayload | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hide = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setNotification(null));
  }, [translateY]);

  const showNotification = useCallback(
    (n: NotificationPayload) => {
      // Clear any existing timer
      if (timerRef.current) clearTimeout(timerRef.current);

      setNotification(n);
      translateY.setValue(-120);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();

      timerRef.current = setTimeout(hide, DISPLAY_MS);
    },
    [translateY, hide],
  );

  const handlePress = () => {
    notification?.onPress?.();
    hide();
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {notification && (
        <Animated.View
          style={[
            ns.container,
            { top: insets.top + 8, transform: [{ translateY }] },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePress}
            style={ns.toast}
          >
            {notification.avatar ? (
              <Image source={{ uri: notification.avatar }} style={ns.avatar} />
            ) : (
              <View style={[ns.avatar, { backgroundColor: 'rgba(99,102,241,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="chatbubble" size={16} color="#818cf8" />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={ns.title} numberOfLines={1}>
                {notification.title}
              </Text>
              <Text style={ns.body} numberOfLines={2}>
                {notification.body}
              </Text>
            </View>
            <TouchableOpacity onPress={hide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotificationContext.Provider>
  );
}

const ns = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,50,0.96)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  title: { color: '#fff', fontWeight: '700', fontSize: 14 },
  body: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 1 },
});
