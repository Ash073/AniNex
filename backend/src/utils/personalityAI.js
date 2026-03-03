const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `
You are the Anime Personality Classification Engine for AniNeX.

Your job is to analyze a user's self-description and classify them into an anime-style archetype.

Rules:
- Respond ONLY in JSON.
- No explanations.
- No extra text.
- No markdown.
- Must be valid JSON.

Return this format:
{
  "personality_type": "",
  "character_match": "",
  "fandom_category": "",
  "power_archetype": "",
  "motivational_title": "",
  "starting_rank": ""
}

Rank must be one of:
Beginner, Skilled, Elite, S-Class, Special Grade

Choose the closest psychologically aligned anime archetype.
Keep it culturally authentic to anime themes.
Keep responses concise but impactful.
`;

/**
 * Analyze a user's description and return an anime personality classification
 * @param {string} description Self-description from the user
 * @returns {Promise<object>} JSON results
 */
async function analyzePersonality(description) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured on the server.");
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.7,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: description }
            ],
            response_format: { type: "json_object" }
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error("AI Personality Analysis Error:", error);
        throw error;
    }
}

module.exports = { analyzePersonality };
