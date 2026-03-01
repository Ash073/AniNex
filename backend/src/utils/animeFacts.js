const fetch = require('node-fetch');

/**
 * A collection of locally stored interesting anime facts for daily notifications (as fallback) 🏮
 */
const ANIME_FACTS = [
    "Spirited Away (2001) was the first non-English animated film to win an Academy Award for Best Animated Feature.",
    "The 'Big Three' usually refers to One Piece, Naruto, and Bleach - the most popular long-running shonen of the 2000s.",
    "Naruto’s favorite ramen shop, 'Ichiraku Ramen,' actually exists in real life in Fukuoka, Japan.",
    "Sailor Moon’s creator, Naoko Takeuchi, is married to the creator of Hunter x Hunter and YuYu Hakusho, Yoshihiro Togashi.",
    "One Piece was originally intended to run for only five years, but Eiichiro Oda kept finding more stories to tell.",
    "The name 'Pokémon' is a portmanteau of the Japanese words 'Poketto Monsutā,' which means 'Pocket Monsters.'",
    "In Attack on Titan, the city's design is based on Nördlingen, a real city in Germany.",
    "Astro Boy was the first anime to be broadcast overseas, premiering in the US in 1963.",
    "Dragon Ball's Goku was inspired by Sun Wukong, the protagonist of the classic Chinese novel 'Journey to the West.'",
    "The death of Portgas D. Ace in One Piece was so significant that it was reported in Japanese newspapers.",
    "Studio Ghibli’s name comes from the Italian noun for 'hot desert wind.'",
    "In Your Name, the fictional town of Itomori was inspired by the real-life city of Hida in Gifu Prefecture.",
    "One-Punch Man started as a webcomic with very simple art before being redrawn by Yusuke Murata.",
    "Cowboy Bebop was nearly canceled during production because its 'too mature' themes worried sponsors.",
    "The hair of Super Saiyans is blonde because it was easier for the manga artists to leave them white (uncolored) to save time.",
    "Akira (1988) used over 160,000 animation cels, which was unheard of at the time.",
    "Kiki’s Delivery Service was the first Studio Ghibli film to be released in partnership with Disney.",
    "The 'Code Geass' pizzas were actually a form of product placement for Pizza Hut in Japan.",
    "Demon Slayer: Mugen Train is currently the highest-grossing anime film of all time worldwide.",
    "Death Note’s Ryuk was originally designed to look more human, but the creators wanted him to look more like a monster.",
    "Jujutsu Kaisen’s Ryomen Sukuna is based on a real figure from Japanese mythology and history.",
    "Vinland Saga is based on the real-life historical accounts of Viking explorations of North America.",
    "Haikyu!! has significantly increased the number of high school students joining volleyball clubs in Japan.",
    "Fullmetal Alchemist: Brotherhood is a more faithful adaptation of the manga than the original 2003 anime.",
    "Neon Genesis Evangelion’s title literally translates to 'New Gospel of the Beginning.'",
    "The red strings of fate in anime come from a Chinese legend about a thread connecting soulmates.",
    "In 'My Neighbor Totoro,' many theory-crafting fans believe Totoro is actually a god of death, though Studio Ghibli denied this.",
    "Makoto Shinkai often incorporates complex weather patterns and stunning light effects as a signature of his work.",
    "Black Clover's Asta was originally going to have a different name in the early sketches.",
    "The 'L' in Death Note sits in such a specific way because it increases his mental capacity by 40% (according to him!)."
];

// Mapping of common anime names to slugs supported by the API
const SLUG_MAP = {
    'Naruto': 'naruto',
    'One Piece': 'one_piece',
    'Bleach': 'bleach',
    'Dragon Ball': 'dragon_ball',
    'Attack on Titan': 'attack_on_titan',
    'Death Note': 'death_note',
    'My Hero Academia': 'my_hero_academia',
    'Black Clover': 'black_clover',
    'Jujutsu Kaisen': 'jujutsu_kaisen',
    'Demon Slayer': 'demon_slayer',
    'Kimetsu no Yaiba': 'demon_slayer',
    'Hunter x Hunter': 'hunter_x_hunter',
    'Fullmetal Alchemist': 'fullmetal_alchemist_brotherhood',
    'Cowboy Bebop': 'cowboy_bebop',
    'Sword Art Online': 'sword_art_online',
    'Tokyo Ghoul': 'tokyo_ghoul',
    'One Punch Man': 'one_punch_man',
    'Boku no Hero Academia': 'my_hero_academia'
};

/**
 * Get random local fact as fallback
 */
const getRandomLocalFact = () => {
    const randomIndex = Math.floor(Math.random() * ANIME_FACTS.length);
    return ANIME_FACTS[randomIndex];
};

/**
 * Fetch a random fact from external API for a specific anime
 */
const fetchExternalFact = async (animeName) => {
    if (!animeName) return null;

    // Normalize anime name to find slug
    let slug = SLUG_MAP[animeName];
    if (!slug) {
        // If not in map, try normalizing the name itself (lower case, spaces to underscores)
        slug = animeName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    try {
        const response = await fetch(`https://anime-facts-rest-api.herokuapp.com/api/v1/${slug}`, {
            timeout: 5000 // 5 seconds timeout
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (data && data.success && data.data && data.data.length > 0) {
            const randomIndex = Math.floor(Math.random() * data.data.length);
            return data.data[randomIndex].fact;
        }
    } catch (error) {
        console.error(`External fact API error (${slug}):`, error.message);
    }

    return null;
};

/**
 * Get personalized fact based on user favorites
 */
const getPersonalizedFact = async (favoriteAnimes) => {
    if (Array.isArray(favoriteAnimes) && favoriteAnimes.length > 0) {
        // Pick 2 random favorites to try
        const candidates = [...favoriteAnimes].sort(() => 0.5 - Math.random());

        for (const anime of candidates.slice(0, 2)) {
            const fact = await fetchExternalFact(anime);
            if (fact) return fact;
        }
    }

    // Fallback to local
    return getRandomLocalFact();
};

module.exports = { ANIME_FACTS, getRandomLocalFact, fetchExternalFact, getPersonalizedFact };
