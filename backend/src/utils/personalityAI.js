/**
 * personalityAI.js — Anime personality analysis powered by Google Gemini
 *
 * Uses gemini-1.5-pro for deep psychological reasoning and accurate
 * anime character matching.  Keeps the same export signature so the
 * route in users.js does NOT need to change.
 */

const { generateJSON } = require('../services/geminiService');

// ─── System prompt (Gemini reasoning prompt) ─────────────────
const SYSTEM_PROMPT = `
You are an advanced anime personality analysis engine for the AniNeX platform.

Your job is to analyze a user's personality description and:
1. Classify them into an anime-style archetype.
2. Determine which real anime character they most closely resemble.
3. Explain your reasoning clearly.

─── ANALYSIS METHODOLOGY ───

Think step-by-step using these psychological dimensions:
• Introversion vs Extroversion — How do they gain energy?
• Leadership ability — Do they lead, follow, or go solo?
• Empathy — How emotionally attuned are they to others?
• Courage — How do they respond to fear and danger?
• Intelligence — Analytical, creative, or street-smart?
• Humor — Serious, sarcastic, playful, or deadpan?
• Emotional stability — Calm under pressure or volatile?
• Strategic thinking — Impulsive or calculated?
• Moral alignment — Lawful, neutral, or chaotic? Good, neutral, or evil?
• Social behavior — Loner, small-circle, or crowd-lover?

Steps:
1. Extract the core personality traits from the user description.
2. Map those traits to psychological dimensions above.
3. Compare against well-known anime character personalities.
4. Select the BEST character match (must be a real, recognizable anime character).
5. Assign an anime archetype, fandom category, power archetype, and rank.

─── OUTPUT FORMAT ───

Return ONLY valid JSON in this exact structure:

{
  "personality_type": "archetype label (e.g. Strategic Anti-Hero, Shonen Hero, Silent Protector)",
  "character_match": "full character name (e.g. Levi Ackerman)",
  "anime": "anime series name (e.g. Attack on Titan)",
  "fandom_category": "genre category (e.g. Psychological Warfare, Battle Shonen, Dark Fantasy)",
  "power_archetype": "signature power style (e.g. Blade Master, Mind Dominator, Elemental Sage)",
  "motivational_title": "an epic title for the user (e.g. The Unyielding Storm)",
  "starting_rank": "one of: Beginner, Skilled, Elite, S-Class, Special Grade",
  "traits": ["trait1", "trait2", "trait3", "trait4", "trait5"],
  "confidence": "percentage (e.g. 87%)",
  "explanation": "2-3 sentences explaining WHY this character matches the user's personality"
}

─── RULES ───
• Output MUST be valid JSON — no extra text, no markdown fences, no commentary.
• character_match MUST be a real anime character (not made up).
• anime MUST be the correct series for that character.
• traits array must contain exactly 5 personality traits.
• starting_rank must be exactly one of: Beginner, Skilled, Elite, S-Class, Special Grade.
• explanation must reference specific traits from the user's description.
• Keep it culturally authentic to anime themes.
`.trim();

// ─── Required output fields ─────────────────────────────────
const REQUIRED_FIELDS = [
  'personality_type',
  'character_match',
  'fandom_category',
  'power_archetype',
  'motivational_title',
  'starting_rank',
];

const VALID_RANKS = ['Beginner', 'Skilled', 'Elite', 'S-Class', 'Special Grade'];

// ─── Fallback when AI is unavailable ─────────────────────────
const FALLBACK_RESPONSE = {
  personality_type: 'Mysterious Wanderer',
  character_match: 'Spike Spiegel',
  anime: 'Cowboy Bebop',
  fandom_category: 'Action/Adventure',
  power_archetype: 'Freestyle Fighter',
  motivational_title: 'The Drifting Star',
  starting_rank: 'Skilled',
  traits: ['adaptable', 'independent', 'laid-back', 'perceptive', 'resilient'],
  confidence: '50%',
  explanation: 'Personality analysis is temporarily unavailable. A default profile has been assigned — you can retry for a personalized result.',
};

/**
 * Validate and sanitize the Gemini response to guarantee all required
 * fields exist and have correct types.
 *
 * @param {object} raw - Parsed JSON from Gemini
 * @returns {object} Cleaned & validated result
 */
function validateResponse(raw) {
  if (!raw || typeof raw !== 'object') {
    console.warn('[PersonalityAI] Validation failed: response is not an object');
    return null;
  }

  // Check all required fields
  for (const field of REQUIRED_FIELDS) {
    if (!raw[field] || typeof raw[field] !== 'string' || raw[field].trim() === '') {
      console.warn(`[PersonalityAI] Validation failed: missing or empty field "${field}"`);
      return null;
    }
  }

  // Validate rank
  if (!VALID_RANKS.includes(raw.starting_rank)) {
    console.warn(`[PersonalityAI] Invalid rank "${raw.starting_rank}", defaulting to Beginner`);
    raw.starting_rank = 'Beginner';
  }

  // Ensure traits is a non-empty string array
  if (!Array.isArray(raw.traits) || raw.traits.length === 0) {
    raw.traits = ['unknown'];
  } else {
    raw.traits = raw.traits.filter((t) => typeof t === 'string' && t.trim() !== '');
  }

  // Ensure string fields
  raw.anime = typeof raw.anime === 'string' ? raw.anime : 'Unknown Anime';
  raw.confidence = typeof raw.confidence === 'string' ? raw.confidence : 'N/A';
  raw.explanation = typeof raw.explanation === 'string' ? raw.explanation : '';

  return raw;
}

/**
 * Analyze a user's self-description and return an anime personality
 * classification using Google Gemini 1.5 Pro.
 *
 * @param {string} description - User's personality self-description
 * @returns {Promise<object>} Validated JSON personality result
 */
async function analyzePersonality(description) {
  const logTag = '[PersonalityAI]';

  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    console.warn(`${logTag} Description too short or invalid, returning fallback.`);
    return { ...FALLBACK_RESPONSE };
  }

  console.log(`${logTag} Analyzing description (${description.length} chars)...`);

  try {
    const raw = await generateJSON(SYSTEM_PROMPT, description.trim());

    const validated = validateResponse(raw);
    if (!validated) {
      console.warn(`${logTag} Gemini returned invalid structure, using fallback.`);
      return { ...FALLBACK_RESPONSE };
    }

    console.log(`${logTag} Success — matched: ${validated.character_match} from ${validated.anime} (${validated.confidence})`);
    return validated;

  } catch (error) {
    console.error(`${logTag} Gemini API error:`, error.message);

    // Return safe fallback so the client always gets a usable response
    return { ...FALLBACK_RESPONSE };
  }
}

module.exports = { analyzePersonality };
