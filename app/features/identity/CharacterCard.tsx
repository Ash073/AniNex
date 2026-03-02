import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RankProgressBar from './RankProgressBar';

interface CharacterCardProps {
    characterName: string;
    personalityType: string;
    rank: string;
    xp: number;
    title: string;
    powerArchetype: string;
    fandomCategory: string;
    streak: number;
    avatar?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CharacterCard: React.FC<CharacterCardProps> = ({
    characterName,
    personalityType,
    rank,
    xp,
    title,
    powerArchetype,
    fandomCategory,
    streak,
    avatar,
}) => {
    return (
        <View style={styles.card}>
            {/* Background decoration */}
            <View style={styles.glow} />

            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.titleGroup}>
                        <Text style={styles.motivationalTitle}>{title}</Text>
                        <Text style={styles.characterName}>{characterName}</Text>
                        <View style={styles.fandomBadge}>
                            <Text style={styles.fandomText}>{fandomCategory}</Text>
                        </View>
                    </View>

                    <View style={styles.avatarContainer}>
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Ionicons name="person" size={40} color="#6366f1" />
                            </View>
                        )}
                        <View style={styles.rankBadge}>
                            <Text style={styles.rankText}>{rank.charAt(0)}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.detailsGrid}>
                    <View style={styles.detailItem}>
                        <Ionicons name="sparkles-outline" size={14} color="#a855f7" />
                        <Text style={styles.detailLabel}>Personality:</Text>
                        <Text style={styles.detailValue}>{personalityType}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Ionicons name="flash-outline" size={14} color="#f59e0b" />
                        <Text style={styles.detailLabel}>Archetype:</Text>
                        <Text style={styles.detailValue}>{powerArchetype}</Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statNum}>{streak}</Text>
                        <Text style={styles.statLabel}>Day Streak 🔥</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statNum}>{xp}</Text>
                        <Text style={styles.statLabel}>Total XP</Text>
                    </View>
                </View>

                <RankProgressBar xp={xp} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 24,
        width: '100%',
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        overflow: 'hidden',
        position: 'relative',
        marginVertical: 16,
    },
    glow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(99,102,241,0.05)',
    },
    content: {
        zIndex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    titleGroup: {
        flex: 1,
        paddingRight: 10,
    },
    motivationalTitle: {
        color: '#a855f7',
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    characterName: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    fandomBadge: {
        backgroundColor: 'rgba(99,102,241,0.15)',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(99,102,241,0.25)',
    },
    fandomText: {
        color: '#818cf8',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: '#6366f1',
    },
    avatarPlaceholder: {
        backgroundColor: 'rgba(99,102,241,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankBadge: {
        position: 'absolute',
        bottom: -5,
        right: -5,
        backgroundColor: '#fff',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    rankText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 16,
    },
    detailsGrid: {
        marginBottom: 20,
        gap: 8,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    detailLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        fontWeight: '500',
    },
    detailValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        paddingTop: 16,
    },
    statBox: {
        alignItems: 'center',
        flex: 1,
    },
    statNum: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '900',
    },
    statLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: 2,
    }
});

export default CharacterCard;
