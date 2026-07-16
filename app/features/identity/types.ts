export type AnimeIdentity = {
    personalityType: string;
    characterName: string;
    fandomCategory: string;
    powerArchetype: string;
    title: string;
    rank: string;
    xp: number;
    streak: number;
};

export type IdentityState = {
    identity: AnimeIdentity | null;
    loading: boolean;
    error: string | null;
};
