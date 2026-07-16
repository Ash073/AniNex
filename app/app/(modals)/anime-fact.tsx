import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function AnimeFactScreen() {
    const { fact } = useLocalSearchParams<{ fact: string }>();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Background/Gradient */}
            <LinearGradient
                colors={['rgba(99, 102, 241, 0.2)', 'rgba(10, 10, 20, 1)']}
                style={StyleSheet.absoluteFill}
            />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.closeBtn}
                    activeOpacity={0.7}
                >
                    <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Daily Anime Fact</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Card */}
                <View style={styles.card}>
                    <LinearGradient
                        colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
                        style={styles.cardInner}
                    >
                        {/* Ornament */}
                        <View style={styles.ornament}>
                            <Ionicons name="sparkles" size={32} color="#fbbf24" />
                        </View>

                        <Text style={styles.factText}>{fact || 'Loading fact...'}</Text>

                        <View style={styles.divider} />

                        <View style={styles.footer}>
                            <View style={styles.logoRow}>
                                <Image
                                    source={require('../../assets/logo/AniNex (1).png')}
                                    style={styles.miniLogo}
                                    resizeMode="contain"
                                />
                                <Text style={styles.footerText}>AniNex Daily Facts</Text>
                            </View>
                            <Text style={styles.emoji}>🎌 ⛩️ 🗼</Text>
                        </View>
                    </LinearGradient>
                </View>

                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.doneBtn}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={['#6366f1', '#8b5cf6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.doneBtnGradient}
                    >
                        <Text style={styles.doneBtnText}>Close</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a14',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    closeBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
        fontFamily: 'Oswald_700Bold',
    },
    scrollContent: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 1,
    },
    card: {
        width: '100%',
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    cardInner: {
        padding: 32,
        alignItems: 'center',
    },
    ornament: {
        marginBottom: 24,
        opacity: 0.8,
    },
    factText: {
        fontSize: 22,
        lineHeight: 34,
        color: '#fff',
        textAlign: 'center',
        fontWeight: '600',
        marginBottom: 32,
    },
    divider: {
        width: 60,
        height: 3,
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
        borderRadius: 2,
        marginBottom: 24,
    },
    footer: {
        alignItems: 'center',
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    miniLogo: {
        width: 24,
        height: 24,
        marginRight: 8,
    },
    footerText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    emoji: {
        fontSize: 20,
    },
    doneBtn: {
        marginTop: 40,
        width: '100%',
        height: 56,
        borderRadius: 16,
        overflow: 'hidden',
    },
    doneBtnGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
