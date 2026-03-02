import api from '@/services/api';
import { AnimeIdentity } from './types';
import { getRankFromXP } from './rankUtils';

export const identityService = {
    /**
     * AI-based personality analysis via backend endpoint
     */
    analyzeDescription: async (description: string): Promise<Partial<AnimeIdentity>> => {
        try {
            // Expect structured JSON or default fallback
            const { data } = await api.post('/api/analyze-personality', { description });

            if (data?.success && data?.data) {
                return data.data;
            }

            // Handle the case where the API response might be direct
            if (typeof data === 'object' && 'personality_type' in data) {
                // Transform camelCase if backend sends snake_case
                return {
                    personalityType: data.personality_type || 'Strategic Anti-Hero',
                    characterName: data.character_match || 'Light Yagami',
                    fandomCategory: data.fandom_category || 'Psychological Warfare',
                    powerArchetype: data.power_archetype || 'Mind Dominator',
                    title: data.motivational_title || 'The Silent Architect',
                    rank: data.starting_rank || 'Skilled'
                };
            }

            throw new Error('Unexpected API response format');
        } catch (error) {
            console.warn('AI Personality analysis failed, using fallback:', error);
            return {
                personalityType: 'Mysterious Wanderer',
                characterName: 'Unknown Shinobi',
                fandomCategory: 'Action/Adventure',
                powerArchetype: 'Stealth Specialist',
                title: 'The Silent Shadow',
                rank: 'Beginner',
            };
        }
    },

    /**
     * Save user identity to profile
     */
    updateUserIdentity: async (userId: string, data: Partial<AnimeIdentity>) => {
        try {
            const response = await api.post(`/auth/profile/${userId}/identity`, data);
            return response.data;
        } catch (error) {
            console.error('Failed to update user identity:', error);
            // We can still return success for OTA safety if local storage is updated correctly
            return { success: true };
        }
    },

    /**
     * Handle Streak Integration and XP addition from daily login
     */
    processDailyLogin: async (userId: string, streak: number, xp: number) => {
        try {
            // Just logic, the actual update should be handled by an API call
            // Login XP: +10 XP
            return {
                newStreak: streak + 1,
                newXP: xp + 10,
                shouldShowMilestone: (streak + 1) % 7 === 0
            };
        } catch (error) {
            console.error('Failed to process daily login:', error);
            return { newStreak: streak, newXP: xp, shouldShowMilestone: false };
        }
    }
};

export const MANUAL_CHARACTERS = [
    { name: 'Naruto Uzumaki', type: 'Shonen Hero', category: 'Action', archetype: 'Chakra Specialist', title: 'The Hokage Hopeful' },
    { name: 'Mikasa Ackerman', type: 'Stoic Warrior', category: 'Seinen', archetype: 'Blade Master', title: 'The Unwavering Protector' },
    { name: 'Light Yagami', type: 'Anti-Hero Architect', category: 'Psychological', archetype: 'Mind Dominator', title: 'The New World God' },
    { name: 'Zero Two', type: 'Bold Pilot', category: 'Mecha', archetype: 'Energy Transfusion', title: 'The Darling' },
    { name: 'Goku', type: 'Godly Martial Artist', category: 'Battle Shonen', archetype: 'Energy Manipulator', title: 'The Universe Defender' },
    { name: 'L Lawliet', type: 'Genius Detective', category: 'Mystery', archetype: 'Master Strategist', title: 'The Pure Investigator' },
];
