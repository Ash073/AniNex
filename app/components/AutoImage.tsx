import { useState, useEffect, useRef } from 'react';
import { Image, View, Text, StyleSheet, Dimensions, Platform, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Standard aspect ratios
const RATIO_SQUARE = 1;        // 1080×1080  (1:1)
const RATIO_PORTRAIT = 4 / 5;  // 1080×1350  (4:5)
const RATIO_LANDSCAPE = 1.91;  // 1080×566   (1.91:1)

/**
 * Snaps a raw aspect ratio to the nearest standard proportion.
 */
function snapToStandard(ratio: number): number {
  const diffs = [
    { r: RATIO_SQUARE, d: Math.abs(ratio - RATIO_SQUARE) },
    { r: RATIO_PORTRAIT, d: Math.abs(ratio - RATIO_PORTRAIT) },
    { r: RATIO_LANDSCAPE, d: Math.abs(ratio - RATIO_LANDSCAPE) },
  ];
  diffs.sort((a, b) => a.d - b.d);
  // Only snap if reasonably close (within 0.25 of a standard)
  if (diffs[0].d < 0.25) return diffs[0].r;
  // Otherwise use the raw ratio clamped between portrait and landscape
  return Math.max(RATIO_PORTRAIT, Math.min(ratio, 2));
}

interface AutoImageProps {
  uri: string;
  maxWidth?: number;
  borderRadius?: number;
  marginBottom?: number;
  showLoadingIndicator?: boolean;
}

export default function AutoImage({
  uri,
  maxWidth,
  borderRadius = 14,
  marginBottom = 8,
  showLoadingIndicator = true,
}: AutoImageProps) {
  const [aspectRatio, setAspectRatio] = useState<number>(RATIO_SQUARE);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [imageOpacity] = useState(new Animated.Value(0));
  const [loadingOpacity] = useState(new Animated.Value(1));
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const containerWidth = maxWidth || SCREEN_WIDTH - 64; // default with padding

  // Build URI with cache buster for retries
  const imageUri = retryCount > 0 ? `${uri}${uri.includes('?') ? '&' : '?'}cb=${retryCount}` : uri;

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!uri) {
      setError(true);
      return;
    }

    // Skip non-http URIs (local file:// or blob: URLs won't work after restart)
    if (!uri.startsWith('http')) {
      console.warn('[AutoImage] Non-HTTP URI, skipping:', uri.substring(0, 60));
      setError(true);
      return;
    }

    setError(false);
    setLoaded(false);

    // Reset animations
    imageOpacity.setValue(0);
    loadingOpacity.setValue(1);

    if (Platform.OS === 'web') {
      const img = new (globalThis as any).Image();
      img.onload = () => {
        if (img.width && img.height) {
          setAspectRatio(snapToStandard(img.width / img.height));
        }
        setLoaded(true);
        animateIn();
      };
      img.onerror = () => {
        handleLoadError();
      };
      img.src = imageUri;
    } else {
      Image.getSize(
        imageUri,
        (w, h) => {
          if (w && h) setAspectRatio(snapToStandard(w / h));
          setLoaded(true);
          animateIn();
        },
        () => {
          handleLoadError();
        },
      );
    }
  }, [uri, retryCount]);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(loadingOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handleLoadError = () => {
    // Auto-retry up to 3 times with increasing delays
    if (retryCount < 3) {
      const delay = (retryCount + 1) * 2000; // 2s, 4s, 6s
      retryTimerRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, delay);
    } else {
      setLoaded(true);
      setError(true);
      Animated.timing(loadingOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleManualRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(false);
    setLoaded(false);
    loadingOpacity.setValue(1);
    imageOpacity.setValue(0);
  };

  if (error || !uri) {
    // Show a placeholder for broken images with retry button
    return (
      <TouchableOpacity
        style={[styles.wrapper, styles.errorWrapper, { borderRadius, marginBottom }]}
        onPress={handleManualRetry}
        activeOpacity={0.7}
      >
        <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.2)" />
        <Text style={styles.errorText}>Image unavailable</Text>
        <View style={styles.retryButton}>
          <Ionicons name="refresh" size={14} color="#818cf8" />
          <Text style={styles.retryText}>Tap to retry</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const height = containerWidth / aspectRatio;

  return (
    <View style={[styles.wrapper, { borderRadius, marginBottom }]}>
      {/* Loading indicator */}
      {showLoadingIndicator && (
        <Animated.View
          style={[
            styles.loadingOverlay,
            {
              opacity: loadingOpacity,
              borderRadius,
            }
          ]}
        >
          <View style={styles.loadingSpinner}>
            <Ionicons name="image-outline" size={24} color="rgba(255,255,255,0.3)" />
          </View>
        </Animated.View>
      )}

      {/* Image with fade-in animation */}
      <Animated.Image
        source={{
          uri: imageUri,
          cache: 'reload',
        }}
        style={[
          styles.image,
          {
            width: '100%',
            height,
            borderRadius,
            opacity: imageOpacity,
          },
        ]}
        resizeMode="cover"
        onError={() => {
          // If Image component itself fails after getSize succeeded
          if (!error) handleLoadError();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    position: 'relative',
  },
  errorWrapper: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    marginTop: 6,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
  retryText: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '600',
  },
  image: {
    width: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  loadingSpinner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});