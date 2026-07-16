const { supabase } = require('../config/supabase');

/**
 * Adds XP to a user and handles level-up logic and badges.
 * @param {string} userId
 * @param {number} amount
 * @returns {Promise<{xp: number, level: number, badges: string[]}>}
 */
const addXP = async (userId, amount) => {
    try {
        // 1. Fetch current progress
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('xp, level, badges')
            .eq('id', userId)
            .single();

        if (fetchError || !user) {
            console.error('Error fetching user for XP update:', fetchError);
            return null;
        }

        let xp = (user.xp || 0) + amount;
        let badges = user.badges || [];

        // 2. Calculate new level (100 XP per level for simplicity)
        const newLevel = Math.floor(xp / 100) + 1;
        const leveledUp = newLevel > (user.level || 1);

        // 3. Handle level-based badges
        if (leveledUp) {
            if (newLevel === 5 && !badges.includes('Reach Level 5')) badges.push('Reach Level 5');
            if (newLevel === 10 && !badges.includes('Reach Level 10')) badges.push('Reach Level 10');
            if (newLevel === 50 && !badges.includes('Reach Level 50')) badges.push('Reach Level 50');
            if (newLevel === 100 && !badges.includes('Legendary Weeb')) badges.push('Legendary Weeb');
        }

        // 4. Persist updates
        const { data: updated, error: updateError } = await supabase
            .from('users')
            .update({ xp, level: newLevel, badges })
            .eq('id', userId)
            .select('xp, level, badges')
            .single();

        if (updateError) {
            console.error('Error updating XP:', updateError);
            return null;
        }

        return updated;
    } catch (error) {
        console.error('addXP failed:', error);
        return null;
    }
};

/**
 * Checks and awards badges based on friend count.
 * @param {string} userId
 * @param {string[]} friends
 * @returns {Promise<void>}
 */
const checkFriendBadges = async (userId, friends) => {
    const count = friends?.length || 0;
    let newBadge = null;

    if (count >= 50) newBadge = 'Community Leader'; // Changed order for correct logic
    else if (count >= 10) newBadge = 'Social Butterfly';
    else if (count >= 1) newBadge = 'First Friend';

    if (!newBadge) return;

    const { data: user } = await supabase.from('users').select('badges').eq('id', userId).single();
    if (user && !user.badges.includes(newBadge)) {
        const updatedBadges = [...user.badges, newBadge];
        await supabase.from('users').update({ badges: updatedBadges }).eq('id', userId);
    }
};

module.exports = { addXP, checkFriendBadges };
