import { useState, useEffect } from 'react';
import { Image, View, Text, StyleSheet, Dimensions, Platform, Animated } from 'react-native';
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
  const [imageOpacity] = useState(new Animated.Value(0));
  const [loadingOpacity] = useState(new Animated.Value(1));

  const containerWidth = maxWidth || SCREEN_WIDTH - 64; // default with padding

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
        // Animate in
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
      img.onerror = () => { 
        setLoaded(true); 
        setError(true);
        Animated.timing(loadingOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      };
      img.src = uri;
    } else {
      Image.getSize(
        uri,
        (w, h) => {
          if (w && h) setAspectRatio(snapToStandard(w / h));
          setLoaded(true);
          // Animate in
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
        },
        () => { 
          setLoaded(true); 
          setError(true);
          Animated.timing(loadingOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        },
      );
    }
  }, [uri]);

  if (error || !uri) {
    // Show a placeholder for broken images
    return (
      <View style={[styles.wrapper, styles.errorWrapper, { borderRadius, marginBottom }]}>
        <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.2)" />
        <Text style={styles.errorText}>Image unavailable</Text>
      </View>
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
        source={{ uri }}
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