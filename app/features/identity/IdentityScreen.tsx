import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { identityService, MANUAL_CHARACTERS } from './identityService';
import { AnimeIdentity } from './types';
import CharacterCard from './CharacterCard';
import { router } from 'expo-router';

const IdentityScreen: React.FC = () => {
    const { user, updateUser } = useAuthStore();
    const [mode, setMode] = useState<'selection' | 'ai' | 'result' | null>(null);
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Partial<AnimeIdentity> | null>(null);

    const handleAIAnalysis = async () => {
        if (description.length < 10) {
            Alert.alert('Analysis Failed', 'Please describe yourself in at least 10 characters.');
            return;
        }

        setLoading(true);
        try {
            const identity = await identityService.analyzeDescription(description);
            setResult(identity);
            setMode('result');
        } catch (error) {
            Alert.alert('Error', 'Unable to analyze your aura right now. Please try again or select manually.');
        } finally {
            setLoading(false);
        }
    };

    const handleManualSelect = (char: typeof MANUAL_CHARACTERS[0]) => {
        const selectedIdentity: Partial<AnimeIdentity> = {
            characterName: char.name,
            personalityType: char.type,
            fandomCategory: char.category,
            powerArchetype: char.archetype,
            title: char.title,
            rank: 'Beginner',
            xp: user?.xp || 0,
        };
        setResult(selectedIdentity);
        setMode('result');
    };

    const handleSaveIdentity = async () => {
        if (!result || !user) return;
        setLoading(true);

        try {
            // Save to global Zustand state
            const typedResult = {
                ...result,
                xp: result.xp ?? user.xp ?? 0,
                streak: user.streak ?? 1,
            } as AnimeIdentity;

            updateUser({
                ...user,
                // Merging into user object as requested (Zustand store handles flat or structured data)
                ...typedResult,
                profile_completed: true,
            });

            // Also call service to persist if needed
            await identityService.updateUserIdentity(user.id || user._id || '', typedResult);

            Alert.alert('Success!', 'Your anime aura has been crystallized.', [
                { text: 'Awesome', onPress: () => router.back() }
            ]);
        } catch (err) {
            console.error(err);
            Alert.alert('Error Saving', 'Something went wrong while saving your identity.');
        } finally {
            setLoading(false);
        }
    };

    const renderInitialState = () => (
        <View style={styles.centerContent}>
            <Text style={styles.mainTitle}>Define Your Anime Aura</Text>
            <Text style={styles.subtitle}>How do you want to be known in the AniNeX metaverse?</Text>

            <TouchableOpacity
                style={styles.optionButton}
                onPress={() => setMode('ai')}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={['#6366f1', '#a855f7']}
                    style={styles.buttonGradient}
                >
                    <Ionicons name="sparkles" size={24} color="#fff" />
                    <View style={styles.buttonTextGroup}>
                        <Text style={styles.buttonTitle}>AI Aura Analysis</Text>
                        <Text style={styles.buttonDesc}>Describe yourself and let the AI find your match</Text>
                    </View>
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.optionButton, styles.secondaryButton]}
                onPress={() => setMode('selection')}
                activeOpacity={0.8}
            >
                <Ionicons name="grid-outline" size={24} color="#fff" />
                <View style={styles.buttonTextGroup}>
                    <Text style={styles.buttonTitle}>Manual Selection</Text>
                    <Text style={styles.buttonDesc}>Browse and choose from elite character archetypes</Text>
                </View>
            </TouchableOpacity>
        </View>
    );

    const renderAIEntry = () => (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.flex}
        >
            <ScrollView contentContainerStyle={styles.scrollArea}>
                <TouchableOpacity style={styles.backLink} onPress={() => setMode(null)}>
                    <Ionicons name="arrow-back" size={20} color="#a855f7" />
                    <Text style={styles.backLinkText}>Back to options</Text>
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>Deep Analysis 🧠</Text>
                <Text style={styles.inputLabel}>Describe yourself in 3–4 lines (personality, habits, likes):</Text>

                <TextInput
                    style={styles.textInput}
                    multiline
                    numberOfLines={6}
                    placeholder="e.g. I am calm but tactical. I love seeing plans come together. My friends say I'm mysterious but loyal..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={description}
                    onChangeText={setDescription}
                    textAlignVertical="top"
                />

                <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleAIAnalysis}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <LinearGradient colors={['#6366f1', '#a855f7']} style={styles.submitGradient}>
                            <Text style={styles.submitText}>Analyze My Anime Aura</Text>
                        </LinearGradient>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );

    const renderSelectionGrid = () => (
        <View style={styles.flex}>
            <TouchableOpacity style={[styles.backLink, { margin: 20 }]} onPress={() => setMode(null)}>
                <Ionicons name="arrow-back" size={20} color="#a855f7" />
                <Text style={styles.backLinkText}>Back to options</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitlePx}>Select Your Core Archetype</Text>

            <FlatList
                data={MANUAL_CHARACTERS}
                keyExtractor={(item) => item.name}
                numColumns={2}
                contentContainerStyle={styles.gridContainer}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.gridItem}
                        onPress={() => handleManualSelect(item)}
                    >
                        <View style={styles.gridItemBackground}>
                            <Ionicons name="person-outline" size={32} color="rgba(168, 85, 247, 0.5)" />
                        </View>
                        <Text style={styles.gridItemName}>{item.name}</Text>
                        <Text style={styles.gridItemType}>{item.type}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );

    const renderResult = () => (
        <ScrollView contentContainerStyle={styles.resultArea}>
            <Text style={styles.auraRevealed}>Your Aura Revealed ✨</Text>

            <CharacterCard
                characterName={result?.characterName || 'Unknown'}
                personalityType={result?.personalityType || 'Unknown'}
                rank={result?.rank || 'Beginner'}
                xp={user?.xp || 0}
                title={result?.title || 'Wanderer'}
                powerArchetype={result?.powerArchetype || 'Commoner'}
                fandomCategory={result?.fandomCategory || 'General'}
                streak={user?.streak || 1}
            />

            <View style={styles.resultActions}>
                <TouchableOpacity style={styles.confirmButton} onPress={handleSaveIdentity} disabled={loading}>
                    <LinearGradient colors={['#22c55e', '#16a34a']} style={styles.confirmGradient}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Confirm & Crystallize</Text>}
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.redoButton} onPress={() => setMode(null)}>
                    <Text style={styles.redoText}>Not me? Redo Analysis</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    return (
        <View style={styles.container}>
            {mode === null && renderInitialState()}
            {mode === 'ai' && renderAIEntry()}
            {mode === 'selection' && renderSelectionGrid()}
            {mode === 'result' && renderResult()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
    },
    flex: { flex: 1 },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    mainTitle: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 48,
    },
    optionButton: {
        borderRadius: 16,
        marginBottom: 20,
        overflow: 'hidden',
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        gap: 16,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        gap: 16,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    buttonTextGroup: {
        flex: 1,
    },
    buttonTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    buttonDesc: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
    },
    scrollArea: {
        padding: 24,
    },
    backLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 32,
    },
    backLinkText: {
        color: '#a855f7',
        fontWeight: '700',
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '900',
        marginBottom: 8,
    },
    sectionTitlePx: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '900',
        marginLeft: 24,
        marginBottom: 20,
    },
    inputLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 15,
        marginBottom: 20,
        lineHeight: 22,
    },
    textInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        color: '#fff',
        padding: 16,
        fontSize: 16,
        height: 160,
        marginBottom: 28,
    },
    submitButton: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    submitGradient: {
        paddingVertical: 18,
        alignItems: 'center',
    },
    submitText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '800',
    },
    gridContainer: {
        paddingHorizontal: 16,
    },
    gridItem: {
        flex: 1,
        margin: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    gridItemBackground: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    gridItemName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 4,
    },
    gridItemType: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
    resultArea: {
        padding: 24,
        alignItems: 'center',
    },
    auraRevealed: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '900',
        marginBottom: 20,
        marginTop: 40,
    },
    resultActions: {
        width: '100%',
        marginTop: 24,
        gap: 16,
    },
    confirmButton: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    confirmGradient: {
        paddingVertical: 18,
        alignItems: 'center',
    },
    confirmText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '800',
    },
    redoButton: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    redoText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 15,
        fontWeight: '600',
    }
});

export default IdentityScreen;
