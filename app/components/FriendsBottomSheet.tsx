import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    Animated,
    PanResponder,
    Modal,
    TouchableOpacity,
    Image,
    FlatList,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.95;

interface Props {
    visible: boolean;
    onClose: () => void;
    friends: any[];
    title?: string;
}

export default function FriendsBottomSheet({ visible, onClose, friends, title = 'Friends' }: Props) {
    const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (visible) {
            Animated.spring(panY, {
                toValue: SCREEN_HEIGHT - MIN_SHEET_HEIGHT,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }).start();
        } else {
            Animated.timing(panY, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gestureState) => {
                const newY = isFullscreen
                    ? (SCREEN_HEIGHT - MAX_SHEET_HEIGHT) + gestureState.dy
                    : (SCREEN_HEIGHT - MIN_SHEET_HEIGHT) + gestureState.dy;

                // Prevent dragging too far up
                if (newY < SCREEN_HEIGHT - MAX_SHEET_HEIGHT - 20) return;

                panY.setValue(newY);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100) {
                    if (isFullscreen) {
                        // Dragged down from fullscreen to mini
                        setIsFullscreen(false);
                        Animated.spring(panY, {
                            toValue: SCREEN_HEIGHT - MIN_SHEET_HEIGHT,
                            useNativeDriver: true,
                        }).start();
                    } else {
                        // Dragged down from mini to close
                        handleClose();
                    }
                } else if (gestureState.dy < -100) {
                    // Dragged up to fullscreen
                    setIsFullscreen(true);
                    Animated.spring(panY, {
                        toValue: SCREEN_HEIGHT - MAX_SHEET_HEIGHT,
                        useNativeDriver: true,
                    }).start();
                } else {
                    // Snap back
                    Animated.spring(panY, {
                        toValue: isFullscreen ? SCREEN_HEIGHT - MAX_SHEET_HEIGHT : SCREEN_HEIGHT - MIN_SHEET_HEIGHT,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    const handleClose = () => {
        Animated.timing(panY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            onClose();
            setIsFullscreen(false);
        });
    };

    const LOCAL_AVATARS: Record<string, any> = {
        '1': require('@/assets/avatar/Avatar1.png.jpeg'),
        '2': require('@/assets/avatar/Avatar2.png.jpeg'),
        '3': require('@/assets/avatar/Avatar3.png.jpeg'),
        '4': require('@/assets/avatar/Avatar4.png.jpeg'),
        '5': require('@/assets/avatar/Avatar5.png.jpeg'),
        '6': require('@/assets/avatar/Avatar6.png.jpeg'),
        '7': require('@/assets/avatar/Avatar7.png.jpeg'),
        '8': require('@/assets/avatar/Avatar8.png.jpeg'),
        'r1': require('@/assets/avatar/Avatarr1.png'),
        'r2': require('@/assets/avatar/Avatarr2.png'),
        'r3': require('@/assets/avatar/Avatarr3.png'),
        'r4': require('@/assets/avatar/Avatarr4.png'),
        'r5': require('@/assets/avatar/Avatarr5.png'),
        'r6': require('@/assets/avatar/Avatarr6.png'),
        'r7': require('@/assets/avatar/Avatarr7.png'),
        'r8': require('@/assets/avatar/Avatarr8.png'),
        'r9': require('@/assets/avatar/Avatarr9.png'),
        'r10': require('@/assets/avatar/Avatarr10.png'),
    };

    const getAvatarSource = (avatar?: string) => {
        if (!avatar) return null;
        if (avatar.startsWith('local:')) return LOCAL_AVATARS[avatar.replace('local:', '')] ?? null;
        if (avatar.startsWith('gallery:')) {
            const uri = avatar.replace('gallery:', '');
            if (uri.startsWith('file') || uri.startsWith('/')) return null;
            return { uri };
        }
        if (avatar.startsWith('http')) return { uri: avatar };
        if (LOCAL_AVATARS[avatar]) return LOCAL_AVATARS[avatar];
        return null;
    };

    const renderFriend = ({ item }: { item: any }) => {
        const avatarSource = getAvatarSource(item.avatar);
        return (
            <TouchableOpacity
                style={styles.friendRow}
                onPress={() => {
                    handleClose();
                    router.push(`/(modals)/user-profile?userId=${item.id || item._id}` as any);
                }}
            >
                <View style={styles.avatarContainer}>
                    {avatarSource ? (
                        <Image source={avatarSource} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarFallback]}>
                            <Ionicons name="person" size={20} color="rgba(255,255,255,0.3)" />
                        </View>
                    )}
                    {item.is_online && <View style={styles.onlineDot} />}
                </View>
                <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{item.display_name || item.username}</Text>
                    <Text style={styles.friendUsername}>@{item.username}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" />
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            transform: [{ translateY: panY }],
                            height: MAX_SHEET_HEIGHT,
                        },
                    ]}
                >
                    <View {...panResponder.panHandlers} style={styles.handleContainer}>
                        <View style={styles.handle} />
                    </View>

                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.count}>{friends.length} anime fans</Text>
                    </View>

                    <FlatList
                        data={friends}
                        renderItem={renderFriend}
                        keyExtractor={(item) => item.id || item._id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.1)" />
                                <Text style={styles.emptyText}>No friends to show yet</Text>
                            </View>
                        }
                    />
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
        backgroundColor: '#16162a',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        width: '100%',
        position: 'absolute',
        bottom: 0,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    handleContainer: {
        width: '100%',
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    handle: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    header: {
        paddingHorizontal: 24,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff',
    },
    count: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 4,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 16,
        marginBottom: 8,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    avatarFallback: {
        backgroundColor: 'rgba(99,102,241,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#22c55e',
        borderWidth: 2,
        borderColor: '#16162a',
    },
    friendInfo: {
        flex: 1,
        marginLeft: 16,
    },
    friendName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    friendUsername: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        marginTop: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.3)',
        marginTop: 16,
        fontSize: 15,
    },
});
