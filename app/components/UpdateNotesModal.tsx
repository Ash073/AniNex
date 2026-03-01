import { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ScrollView,
    StyleSheet,
    Animated,
    Dimensions,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ══════════════════════════════════════════════════════════
//  UPDATE NOTES — Edit this for each new version
// ══════════════════════════════════════════════════════════
export const CURRENT_VERSION = '1.0.0';
const STORAGE_KEY = `@animex_update_dismissed_v${CURRENT_VERSION}`;

export interface UpdateNote {
    icon: string;
    iconColor: string;
    title: string;
    description: string;
    tag?: string;
    tagColor?: string;
}

export const UPDATE_NOTES: UpdateNote[] = [
    {
        icon: 'at',
        iconColor: '#ec4899',
        title: 'Mention Friends in Posts',
        description:
            'Tag anyone using @username while creating a post. They\'ll receive a notification instantly.',
        tag: 'New',
        tagColor: '#22c55e',
    },
    {
        icon: 'notifications',
        iconColor: '#f59e0b',
        title: 'Push Notifications',
        description:
            'Stay in the loop — get notified for DMs, server messages, friend requests, and mentions even when the app is closed.',
        tag: 'New',
        tagColor: '#22c55e',
    },
    {
        icon: 'flash',
        iconColor: '#6366f1',
        title: 'Posts Appear Instantly',
        description:
            'Your posts and images now show up in the feed immediately after you share them. No more waiting.',
        tag: 'Fixed',
        tagColor: '#3b82f6',
    },
    {
        icon: 'chatbubbles',
        iconColor: '#818cf8',
        title: 'Server Messaging Improved',
        description:
            'Messages in servers are no longer sent twice. Sending is now reliable and fast.',
        tag: 'Fixed',
        tagColor: '#3b82f6',
    },
    {
        icon: 'images',
        iconColor: '#22c55e',
        title: 'Smarter Image Loading',
        description:
            'Post images that fail to load will automatically retry. You can also tap any failed image to reload it.',
        tag: 'Improved',
        tagColor: '#f59e0b',
    },
];

// ══════════════════════════════════════════════════════════

interface UpdateNotesModalProps {
    visible: boolean;
    onClose: () => void;
    permanent?: boolean; // If true, dismissing stores in AsyncStorage
}

export default function UpdateNotesModal({ visible, onClose, permanent = true }: UpdateNotesModalProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    damping: 20,
                    stiffness: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    damping: 20,
                    stiffness: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const handleClose = async () => {
        // Persist immediately if permanent
        if (permanent) {
            try {
                await SecureStore.setItemAsync(STORAGE_KEY, 'true');
            } catch { }
        }

        // Animate out
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 50,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose();
        });
    };

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
            <Animated.View style={[st.overlay, { opacity: fadeAnim }]}>
                <Animated.View
                    style={[
                        st.container,
                        {
                            transform: [
                                { translateY: slideAnim },
                                { scale: scaleAnim },
                            ],
                        },
                    ]}
                >
                    {/* Header */}
                    <View style={st.header}>
                        <View style={st.versionBadge}>
                            <Ionicons name="sparkles" size={14} color="#fbbf24" />
                            <Text style={st.versionText}>v{CURRENT_VERSION}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={st.title}>What's New ✨</Text>
                            <Text style={st.subtitle}>Update {CURRENT_VERSION}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={handleClose}
                            style={st.closeBtn}
                            hitSlop={12}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                    </View>

                    {/* Divider */}
                    <View style={st.divider} />

                    {/* Notes list */}
                    <ScrollView
                        style={st.scrollArea}
                        contentContainerStyle={{ paddingBottom: 16 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {UPDATE_NOTES.map((note, idx) => (
                            <View key={idx} style={st.noteCard}>
                                {/* Icon */}
                                <View style={[st.noteIcon, { backgroundColor: `${note.iconColor}20` }]}>
                                    <Ionicons name={note.icon as any} size={20} color={note.iconColor} />
                                </View>

                                {/* Content */}
                                <View style={st.noteContent}>
                                    <View style={st.noteTitleRow}>
                                        <Text style={st.noteTitle}>{note.title}</Text>
                                        {note.tag && (
                                            <View style={[st.noteTag, { backgroundColor: `${note.tagColor || '#6366f1'}20` }]}>
                                                <Text style={[st.noteTagText, { color: note.tagColor || '#6366f1' }]}>
                                                    {note.tag}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={st.noteDesc}>{note.description}</Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Footer */}
                    <View style={st.footer}>
                        <TouchableOpacity
                            style={st.gotItBtn}
                            onPress={handleClose}
                            activeOpacity={0.8}
                        >
                            <Text style={st.gotItText}>Got it!</Text>
                            <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        </TouchableOpacity>
                        <Text style={st.footerNote}>
                            You can view this again from Profile → What's New
                        </Text>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

// ── Check if update notes should show ──
export async function shouldShowUpdateNotes(): Promise<boolean> {
    try {
        const dismissed = await SecureStore.getItemAsync(STORAGE_KEY);
        return dismissed !== 'true';
    } catch {
        return true;
    }
}

// ── Reset dismissal (for testing) ──
export async function resetUpdateNotes(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
    } catch { }
}

const st = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        width: '100%',
        maxWidth: 420,
        maxHeight: '85%',
        backgroundColor: '#12122a',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(99,102,241,0.2)',
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#6366f1',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 24,
            },
            android: {
                elevation: 16,
            },
        }),
    },

    /* Header */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
    },
    versionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(251,191,36,0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(251,191,36,0.2)',
    },
    versionText: {
        color: '#fbbf24',
        fontSize: 12,
        fontWeight: '800',
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '800',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* Divider */
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginHorizontal: 20,
    },

    /* Scroll area */
    scrollArea: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },

    /* Note card */
    noteCard: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 12,
    },
    noteIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    noteContent: {
        flex: 1,
    },
    noteTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
        flexWrap: 'wrap',
    },
    noteTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    noteTag: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    noteTagText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    noteDesc: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        lineHeight: 19,
    },

    /* Footer */
    footer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
    },
    gotItBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#6366f1',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 16,
        width: '100%',
        ...Platform.select({
            ios: {
                shadowColor: '#6366f1',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    gotItText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 16,
    },
    footerNote: {
        color: 'rgba(255,255,255,0.25)',
        fontSize: 11,
        marginTop: 10,
        textAlign: 'center',
    },
});
