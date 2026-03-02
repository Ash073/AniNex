export const RANK_THRESHOLDS = [
    { min: 0, max: 50, rank: 'Beginner' },
    { min: 51, max: 150, rank: 'Skilled' },
    { min: 151, max: 300, rank: 'Elite' },
    { min: 301, max: 500, rank: 'S-Class' },
    { min: 501, max: Infinity, rank: 'Special Grade' },
];

export const XP_ACTIONS = {
    DAILY_LOGIN: 10,
    POST: 5,
    COMMENT: 3,
    DEBATE_WIN: 20,
};

/**
 * Returns the rank name based on XP value
 */
export const getRankFromXP = (xp: number): string => {
    const threshold = RANK_THRESHOLDS.find(
        (t) => xp >= t.min && xp <= t.max
    );
    return threshold ? threshold.rank : 'Beginner';
};

/**
 * Returns the progress towards the next rank
 */
export const getRankProgress = (xp: number) => {
    const currentThresholdIndex = RANK_THRESHOLDS.findIndex(
        (t) => xp >= t.min && xp <= t.max
    );

    if (currentThresholdIndex === -1) return { percent: 0, nextRank: 'Beginner', nextMin: 0 };

    const current = RANK_THRESHOLDS[currentThresholdIndex];
    const next = RANK_THRESHOLDS[currentThresholdIndex + 1];

    if (!next) return { percent: 100, nextRank: 'Max', nextMin: current.max };

    const range = next.min - current.min;
    const progress = xp - current.min;
    const percent = Math.min(Math.max((progress / range) * 100, 0), 100);

    return {
        percent,
        nextRank: next.rank,
        nextMin: next.min,
        currentRank: current.rank
    };
};
