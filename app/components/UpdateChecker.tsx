import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';

export const UpdateChecker = () => {
    const [status, setStatus] = useState<'checking' | 'downloading' | 'ready' | 'idle'>('idle');
    const [visible, setVisible] = useState(false);
    const slideAnim = React.useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        // Only run in production builds
        if (__DEV__) return;

        const checkUpdates = async () => {
            try {
                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    setVisible(true);
                    setStatus('downloading');

                    await Updates.fetchUpdateAsync();
                    setStatus('ready');

                    // Small delay before reload
                    setTimeout(async () => {
                        await Updates.reloadAsync();
                    }, 2000);
                }
            } catch (error) {
                console.log('Update check failed:', error);
                setVisible(false);
            }
        };

        checkUpdates();
    }, []);

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: Platform.OS === 'ios' ? 50 : 20,
                useNativeDriver: true,
                tension: 50,
                friction: 8
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true
            }).start();
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.card}>
                <View style={styles.iconContainer}>
                    {status === 'downloading' ? (
                        <ActivityIndicator size="small" color="#6366f1" />
                    ) : (
                        <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                    )}
                </View>
                <View style={styles.textContainer}>
                    <Text style={st.statusText}>
                        {status === 'downloading' ? 'Downloading Update...' : 'Update Applied!'}
                    </Text>
                    <Text style={st.subText}>
                        {status === 'downloading' ? 'Fetching new anime content' : 'Restarting app...'}
                    </Text>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#1a1a2e',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        width: '100%',
        maxWidth: 400,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
});

const st = StyleSheet.create({
    statusText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    subText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
        marginTop: 2,
    }
});
