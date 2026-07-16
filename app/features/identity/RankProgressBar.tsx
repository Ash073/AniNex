import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { getRankProgress } from './rankUtils';
import { LinearGradient } from 'expo-linear-gradient';

interface RankProgressBarProps {
    xp: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const RankProgressBar: React.FC<RankProgressBarProps> = ({ xp }) => {
    const { percent, currentRank, nextRank, nextMin } = getRankProgress(xp);
    const animatedWidth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedWidth, {
            toValue: Math.max(0, percent),
            duration: 1200,
            useNativeDriver: false, // width can't use native driver
        }).start();
    }, [percent]);

    const widthStyle = animatedWidth.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.rankLabel}>{currentRank}</Text>
                <Text style={styles.xpLabel}>{xp} / {nextMin} XP</Text>
            </View>

            <View style={styles.barContainer}>
                {/* Background track */}
                <View style={styles.track} />

                {/* Animated fill */}
                <Animated.View style={[styles.fill, { width: widthStyle }]}>
                    <LinearGradient
                        colors={['#6366f1', '#a855f7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.nextRankLabel}>Next: {nextRank}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 8,
    },
    rankLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    xpLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontWeight: '600',
    },
    barContainer: {
        height: 10,
        width: '100%',
        borderRadius: 5,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    track: {
        ...StyleSheet.absoluteFillObject,
    },
    fill: {
        height: '100%',
        borderRadius: 5,
        overflow: 'hidden',
    },
    footer: {
        marginTop: 6,
        alignItems: 'flex-end',
    },
    nextRankLabel: {
        color: '#a855f7',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
});

export default RankProgressBar;
