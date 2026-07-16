import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

// Spinner loader inspired by the provided CSS `.loader`
const SpinnerLoader = () => {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [spin]);

  const baseStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: '45deg' }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [
      { rotateX: '70deg' },
      { rotateZ: `${spin.value * 360}deg` },
    ],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [
      { rotateY: '70deg' },
      { rotateZ: `${spin.value * 360}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.spinner, baseStyle]}>
      <Animated.View style={[styles.spinnerRing, styles.spinnerRingPrimary, ring1Style]} />
      <Animated.View style={[styles.spinnerRing, styles.spinnerRingAccent, ring2Style]} />
    </Animated.View>
  );
};

const Loader = () => (
  <View style={styles.container}>
    <LinearGradient
      colors={['#1a2236', '#232946', '#0a0a14']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={styles.centerContent}>
      <SpinnerLoader />
    </View>
  </View>
);

export default Loader;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1,
  },
  spinner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  spinnerRingPrimary: {
    borderTopColor: '#ffffff',
  },
  spinnerRingAccent: {
    borderRightColor: '#FF3D00',
  },
});
