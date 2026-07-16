const express = require('express');
const { supabase } = require('../config/supabase');
const { generateToken, generateRefreshToken } = require('../config/jwt');
const bcrypt = require('bcryptjs');

const router = express.Router();

// ─── Config from environment ────────────────────────────────────────────
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FACEBOOK_APP_ID      = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET  = process.env.FACEBOOK_APP_SECRET;
const CLIENT_URL           = process.env.CLIENT_URL  || 'https://aninex-1.onrender.com';
const DISCORD_CLIENT_ID    = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET= process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://aninex-1.onrender.com/api/auth/oauth/discord/callback';
const getBackendUrl = (req) => {
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host  = req.get('x-forwarded-host')  || req.get('host');
  return `${proto}://${host}`;
};

// ─── Helpers ────────────────────────────────────────────────────────────

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

/** Find an existing user by email or create a new one from the OAuth profile */
const findOrCreateUser = async ({ email, name, picture }) => {
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .ilike('email', email)
    .single();

  if (existingUser) {
    await supabase
      .from('users')
      .update({ is_online: true, last_seen: new Date().toISOString() })
      .eq('id', existingUser.id);
    return existingUser;
  }

  // Generate unique username
  let baseUsername = (name || 'user')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()
    .slice(0, 15);
  if (baseUsername.length < 3) baseUsername = 'user';
  let username = baseUsername;
  let suffix = 1;

  while (true) {
    const { data: taken } = await supabase
      .from('users')
      .select('id')
      .ilike('username', username)
      .single();
    if (!taken) break;
    username = `${baseUsername}${suffix}`;
    suffix++;
  }

  const randomPassword = require('crypto').randomBytes(32).toString('hex');
  const hashedPassword = await bcrypt.hash(randomPassword, 12);

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      username,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      display_name: name || username,
      avatar: picture || '',
      onboarding_completed: false,
      profile_completed: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return newUser;
};

/**
 * After successful OAuth, deliver JWT tokens + user to the client.
 *  - web    → HTTP redirect to CLIENT_URL/oauth-callback?token=…
 *  - mobile → HTML page that deep-links to animex://oauth?token=…
 */
const sendAuthResult = (res, user, platform, mobileRedirectUri) => {
  const token        = generateToken(user.id);
  const refreshToken = generateRefreshToken(user.id);
  const safeUser     = sanitizeUser(user);
  const userData     = encodeURIComponent(JSON.stringify(safeUser));

  if (platform === 'mobile') {
    // Use the redirect URI provided by the mobile client (works for both Expo Go and standalone builds).
    // Falls back to animex://oauth if not provided.
    const baseUri = mobileRedirectUri || 'animex://oauth';
    const separator = baseUri.includes('?') ? '&' : '?';
    const deepLink =
      baseUri +
      `${separator}token=${encodeURIComponent(token)}` +
      `&refreshToken=${encodeURIComponent(refreshToken)}` +
      `&user=${userData}`;

    console.log('[OAuth] Mobile deep link redirect:', deepLink.substring(0, 120) + '...');
    // Use a direct HTTP 302 redirect so that Chrome Custom Tabs / ASWebAuthenticationSession
    // reliably intercepts the custom-scheme URL and returns it to the app.
    return res.redirect(deepLink);
  }

  // Web: redirect with tokens in query string
  const redirect =
    `${CLIENT_URL}/oauth-callback` +
    `?token=${encodeURIComponent(token)}` +
    `&refreshToken=${encodeURIComponent(refreshToken)}` +
    `&user=${userData}`;

  res.redirect(redirect);
};

/** Send a styled error page (for callback failures) */
const sendAuthError = (res, message) => {
  res.setHeader('Content-Type', 'text/html');
  res.status(400).send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Auth Error</title>
<script src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.8.11/dist/dotlottie-wc.js" type="module"></script>
<style>body{background:#0f0f1e;color:#fff;display:flex;justify-content:center;
       align-items:center;height:100vh;margin:0;font-family:sans-serif;text-align:center}
       a{color:#6366f1}p{margin:8px 0}</style></head>
<body><div>
  <dotlottie-wc src="https://lottie.host/a40c9783-8abd-4d5e-85d5-03e2b9c0f79d/aQIw6mPBAV.lottie" style="width:200px;height:200px" autoplay loop></dotlottie-wc>
  <p>${message}</p><p><a href="javascript:window.close()">Close this window</a></p>
</div></body>
</html>`);
};

// ═══════════════════════════════════════════════════════════════════════
//  GOOGLE  –  Authorization Code Flow
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/auth/oauth/google?platform=web|mobile
 * Redirects the browser to Google's consent screen.
 */
router.get('/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured' });

  const platform    = req.query.platform || 'web';
  const mobileRedirectUri = req.query.redirect_uri || '';
  const backendUrl  = getBackendUrl(req);
  const state       = Buffer.from(JSON.stringify({ platform, provider: 'google', backendUrl, mobileRedirectUri })).toString('base64url');
  const redirectUri = `${backendUrl}/api/auth/oauth/google/callback`;

  const url =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('openid email profile')}` +
    `&state=${encodeURIComponent(state)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  console.log('[OAuth] Google redirect_uri:', redirectUri);
  res.redirect(url);
});

/**
 * GET /api/auth/oauth/google/callback?code=…&state=…
 * Google redirects here after the user consents.
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state: rawState, error: oauthError } = req.query;

    if (oauthError) {
      console.error('Google OAuth error:', oauthError);
      return sendAuthError(res, 'Google sign-in was cancelled or failed.');
    }

    let platform = 'web';
    let backendUrl = getBackendUrl(req);
    let mobileRedirectUri = '';
    try {
      const parsed = JSON.parse(Buffer.from(rawState, 'base64url').toString());
      platform = parsed.platform || 'web';
      if (parsed.backendUrl) backendUrl = parsed.backendUrl;
      if (parsed.mobileRedirectUri) mobileRedirectUri = parsed.mobileRedirectUri;
    } catch {}

    if (!code) return sendAuthError(res, 'Authorization code missing.');

    // Exchange authorization code for tokens
    const redirectUri = `${backendUrl}/api/auth/oauth/google/callback`;
    console.log('[OAuth] Google token exchange redirect_uri:', redirectUri);
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Google token exchange failed:', errBody);
      return sendAuthError(res, 'Failed to exchange Google code for token.');
    }

    const tokenData = await tokenRes.json();

    // Fetch user profile
    const userInfoRes = await fetch('https://www.googleapis.com/userinfo/v2/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) throw new Error('Failed to get Google user info');
    const googleUser = await userInfoRes.json();

    if (!googleUser?.email) {
      return sendAuthError(res, 'Could not get email from Google.');
    }

    const user = await findOrCreateUser({
      email: googleUser.email,
      name: googleUser.name || googleUser.email.split('@')[0],
      picture: googleUser.picture,
    });

    sendAuthResult(res, user, platform, mobileRedirectUri);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    sendAuthError(res, 'Authentication failed. Please try again.');
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  FACEBOOK  –  Authorization Code Flow
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
//  DISCORD  –  Authorization Code Flow
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/auth/oauth/discord?platform=web|mobile
 * Redirects the browser to Discord's consent screen.
 */
router.get('/discord', (req, res) => {
  if (!DISCORD_CLIENT_ID) return res.status(500).json({ error: 'DISCORD_CLIENT_ID not configured' });

  const platform    = req.query.platform || 'web';
  const mobileRedirectUri = req.query.redirect_uri || '';
  const backendUrl  = getBackendUrl(req);
  const state       = Buffer.from(JSON.stringify({ platform, provider: 'discord', backendUrl, mobileRedirectUri })).toString('base64url');
  const redirectUri = `${backendUrl}/api/auth/oauth/discord/callback`;

  const url =
    `https://discord.com/oauth2/authorize` +
    `?client_id=${DISCORD_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=identify email` +
    `&state=${encodeURIComponent(state)}`;

  console.log('[OAuth] Discord redirect_uri:', redirectUri);
  res.redirect(url);
});

/**
 * GET /api/auth/oauth/discord/callback?code=…&state=…
 * Discord redirects here after the user consents.
 */
router.get('/discord/callback', async (req, res) => {
  try {
    const { code, state: rawState, error: oauthError } = req.query;

    if (oauthError) {
      console.error('Discord OAuth error:', oauthError);
      return sendAuthError(res, 'Discord sign-in was cancelled or failed.');
    }

    let platform = 'web';
    let backendUrl = getBackendUrl(req);
    let mobileRedirectUri = '';
    try {
      const parsed = JSON.parse(Buffer.from(rawState, 'base64url').toString());
      platform = parsed.platform || 'web';
      if (parsed.backendUrl) backendUrl = parsed.backendUrl;
      if (parsed.mobileRedirectUri) mobileRedirectUri = parsed.mobileRedirectUri;
    } catch {}

    if (!code) return sendAuthError(res, 'Authorization code missing.');

    // Exchange authorization code for tokens
    const redirectUri = `${backendUrl}/api/auth/oauth/discord/callback`;
    console.log('[OAuth] Discord token exchange redirect_uri:', redirectUri);
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Discord token exchange failed:', errBody);
      return sendAuthError(res, 'Failed to exchange Discord code for token.');
    }

    const tokenData = await tokenRes.json();

    // Fetch user profile
    const userInfoRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) throw new Error('Failed to get Discord user info');
    const discordUser = await userInfoRes.json();

    if (!discordUser?.email) {
      return sendAuthError(res, 'Could not get email from Discord. Make sure email permission is granted.');
    }

    const user = await findOrCreateUser({
      email: discordUser.email,
      name: discordUser.username || 'User',
      picture: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : '',
    });

    sendAuthResult(res, user, platform, mobileRedirectUri);
  } catch (err) {
    console.error('Discord OAuth callback error:', err);
    sendAuthError(res, 'Authentication failed. Please try again.');
  }
});

/**
 * GET /api/auth/oauth/facebook?platform=web|mobile
 */
router.get('/facebook', (req, res) => {
  if (!FACEBOOK_APP_ID) return res.status(500).json({ error: 'FACEBOOK_APP_ID not configured' });

  const platform    = req.query.platform || 'web';
  const mobileRedirectUri = req.query.redirect_uri || '';
  const backendUrl  = getBackendUrl(req);
  const state       = Buffer.from(JSON.stringify({ platform, provider: 'facebook', backendUrl, mobileRedirectUri })).toString('base64url');
  const redirectUri = `${backendUrl}/api/auth/oauth/facebook/callback`;

  const url =
    `https://www.facebook.com/v18.0/dialog/oauth` +
    `?client_id=${FACEBOOK_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=email,public_profile` +
    `&state=${encodeURIComponent(state)}`;

  console.log('[OAuth] Facebook redirect_uri:', redirectUri);
  res.redirect(url);
});

/**
 * GET /api/auth/oauth/facebook/callback?code=…&state=…
 */
router.get('/facebook/callback', async (req, res) => {
  try {
    const { code, state: rawState, error_description } = req.query;

    if (error_description) {
      console.error('Facebook OAuth error:', error_description);
      return sendAuthError(res, 'Facebook sign-in was cancelled or failed.');
    }

    let platform = 'web';
    let backendUrl = getBackendUrl(req);
    let mobileRedirectUri = '';
    try {
      const parsed = JSON.parse(Buffer.from(rawState, 'base64url').toString());
      platform = parsed.platform || 'web';
      if (parsed.backendUrl) backendUrl = parsed.backendUrl;
      if (parsed.mobileRedirectUri) mobileRedirectUri = parsed.mobileRedirectUri;
    } catch {}

    if (!code) return sendAuthError(res, 'Authorization code missing.');

    const redirectUri = `${backendUrl}/api/auth/oauth/facebook/callback`;
    console.log('[OAuth] Facebook token exchange redirect_uri:', redirectUri);

    // Exchange code for access_token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token` +
      `?client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${FACEBOOK_APP_SECRET}` +
      `&code=${code}`
    );

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Facebook token exchange failed:', errBody);
      return sendAuthError(res, 'Failed to exchange Facebook code for token.');
    }

    const tokenData = await tokenRes.json();

    // Fetch user profile
    const userInfoRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${tokenData.access_token}`
    );

    if (!userInfoRes.ok) throw new Error('Failed to get Facebook user info');
    const fbUser = await userInfoRes.json();

    if (!fbUser?.email) {
      return sendAuthError(res, 'Could not get email from Facebook. Make sure email permission is granted.');
    }

    const user = await findOrCreateUser({
      email: fbUser.email,
      name: fbUser.name || 'User',
      picture: fbUser.picture?.data?.url || '',
    });

    sendAuthResult(res, user, platform, mobileRedirectUri);
  } catch (err) {
    console.error('Facebook OAuth callback error:', err);
    sendAuthError(res, 'Authentication failed. Please try again.');
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  CONFIG ENDPOINT  –  Frontend can fetch provider availability
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/auth/oauth/providers
 * Returns which OAuth providers are configured (no secrets exposed).
 */
router.get('/providers', (req, res) => {
  res.json({
    google:   !!GOOGLE_CLIENT_ID && !!GOOGLE_CLIENT_SECRET,
    facebook: !!FACEBOOK_APP_ID && !!FACEBOOK_APP_SECRET,
    discord:  !!DISCORD_CLIENT_ID && !!DISCORD_CLIENT_SECRET,
  });
});

module.exports = router;
