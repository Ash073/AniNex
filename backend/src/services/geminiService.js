/**
 * geminiService.js — Google Gemini API client for AniNeX
 *
 * Low-level wrapper around @google/generative-ai SDK.
 * Provides:
 *   • model initialization with safety settings
 *   • structured JSON generation with validation
 *   • timeout protection
 *   • retry with exponential backoff
 *   • request / response logging
 */

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// ─── Configuration ───────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = 'gemini-1.5-pro';
const REQUEST_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1_500;

// ─── SDK init (lazy — only when first called) ────────────────
let genAI = null;
let model = null;

function getModel() {
  if (!GEMINI_API_KEY) {
    throw new Error('[GeminiService] GEMINI_API_KEY is not set in environment variables.');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      // Keep safety filters lenient — anime content is fictional
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',   // force JSON output
      },
    });
    console.log(`[GeminiService] Initialized model: ${DEFAULT_MODEL}`);
  }
  return model;
}

// ─── Timeout helper ──────────────────────────────────────────
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Gemini request timed out after ${ms}ms`)), ms);
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

// ─── Sleep helper ────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Send a prompt to Gemini and receive validated JSON back.
 *
 * @param {string} systemPrompt  - System-level instruction
 * @param {string} userPrompt    - User input
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]  - Override default timeout
 * @param {number} [opts.maxRetries] - Override default retries
 * @returns {Promise<object>} Parsed JSON from Gemini
 */
async function generateJSON(systemPrompt, userPrompt, opts = {}) {
  const timeoutMs = opts.timeoutMs || REQUEST_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? MAX_RETRIES;

  const geminiModel = getModel();
  const startTime = Date.now();
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        console.log(`[GeminiService] Retry ${attempt}/${maxRetries} after ${backoff}ms...`);
        await sleep(backoff);
      }

      console.log(`[GeminiService] Request (attempt ${attempt + 1}) — prompt length: ${userPrompt.length} chars`);

      // Gemini 1.5 Pro uses system instruction via the model config or inline
      const fullPrompt = `${systemPrompt}\n\n---\nUser input:\n${userPrompt}`;

      const result = await withTimeout(
        geminiModel.generateContent(fullPrompt),
        timeoutMs,
      );

      const response = result.response;
      const text = response.text();

      console.log(`[GeminiService] Response received in ${Date.now() - startTime}ms — length: ${text.length} chars`);

      // ── Parse JSON ──
      const parsed = parseJSONSafe(text);
      if (!parsed) {
        throw new Error(`Invalid JSON in Gemini response: ${text.substring(0, 200)}`);
      }

      console.log('[GeminiService] Valid JSON parsed successfully.');
      return parsed;

    } catch (err) {
      lastError = err;
      console.error(`[GeminiService] Attempt ${attempt + 1} failed:`, err.message);

      // Don't retry on non-transient errors
      if (err.message.includes('API key') || err.message.includes('not set')) {
        break;
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error('[GeminiService] All retries failed.');
}

/**
 * Safely parse JSON from Gemini's response text.
 * Handles cases where the model might wrap JSON in markdown code fences.
 *
 * @param {string} text
 * @returns {object|null}
 */
function parseJSONSafe(text) {
  if (!text || typeof text !== 'string') return null;

  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON object from surrounding text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

module.exports = {
  generateJSON,
  parseJSONSafe,
  DEFAULT_MODEL,
};
