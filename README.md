# AniNeX

An anime-themed social platform built with **Expo (React Native)** and a **Node.js/Express** backend using **Supabase** as the database.

---

## Project Structure

`
animex/
  app/                  # Expo React Native frontend
    app/              # Expo Router screens
      (auth)/       # Auth screens (login, register, onboarding, etc.)
      (tabs)/       # Tab screens (home, servers, discover, profile)
      (modals)/     # Modal screens (chat, DM, notifications, etc.)
    components/       # Reusable components
    hooks/            # Custom hooks (useSocket, etc.)
    services/         # API and socket services
    store/            # Zustand state stores
    utils/            # Utility functions
    constants/        # API URLs and constants
  backend/              # Node.js Express backend
    server.js         # Entry point
    src/
      config/       # Supabase and JWT config
      middleware/    # Auth middleware
      routes/       # REST API routes
      socket/       # Socket.IO handlers
      utils/        # Notification and push helpers
`

---

## Tech Stack

### Frontend
- Expo SDK 54 (React Native)
- Expo Router for navigation
- Zustand for state management
- TanStack React Query for data fetching
- Socket.IO Client for real-time messaging
- Expo Notifications for push notifications
- NativeWind (TailwindCSS for RN)

### Backend
- Node.js + Express
- Socket.IO for real-time WebSocket communication
- Supabase (PostgreSQL) for database
- JWT for authentication
- Expo Push API for sending push notifications
- Google Gemini 1.5 Pro for AI personality analysis

---

## Changelog

### Update 1.4.0 — 2026-03-04

#### Feature: Gemini-Powered Personality Analysis
- **AI Engine Upgrade**: Replaced OpenAI `gpt-4o-mini` with Google **Gemini 1.5 Pro** for significantly more accurate anime personality matching.
- **Deep Psychological Reasoning**: New prompt analyzes 10 psychological dimensions (introversion/extroversion, leadership, empathy, courage, intelligence, humor, emotional stability, strategic thinking, moral alignment, social behavior) before selecting a character match.
- **Richer Results**: Responses now include the matched `anime` series name, a `traits` array of 5 personality traits, a `confidence` percentage, and a detailed `explanation` of why the character was chosen — all in addition to the existing fields.
- **Service Architecture**: Added `geminiService.js` as a reusable low-level Gemini API client with timeout protection (30s), exponential backoff retry (2 attempts), JSON validation, and markdown code-fence stripping.
- **Production Safety**: `personalityAI.js` now validates every field from the AI response and returns a graceful fallback if any call fails — the server never crashes on AI errors.
- **Backward Compatible**: Frontend `identityService.ts` continues to work unchanged — all original fields (`personality_type`, `character_match`, `fandom_category`, `power_archetype`, `motivational_title`, `starting_rank`) are preserved.

#### Notification System V3 — Full Rebuild
- **Multi-Device Push**: New `push_tokens` table supports multiple devices per user. The service iterates all active tokens when delivering push notifications.
- **3-Layer Deduplication**: Memory cache (30s TTL) + DB unique index on `idempotency_key` + controller-generated deterministic keys prevent duplicate pushes.
- **Rate Limiting**: Sliding window rate limiter (30 notifications/user/minute) prevents push spam.
- **Auto Token Cleanup**: `DeviceNotRegistered` errors automatically remove stale tokens from both `push_tokens` and legacy `users.push_token`.
- **Structured Logging**: Every notification step tagged with `[module:type:userId]` for production debugging.
- **Batch Safety**: `sendBatchPush()` limited to 2 retries max — eliminates the infinite retry loop from V2.
- **Backward-Compatible Shims**: `expoPush.js` and `notificationHelper.js` re-export from the new modules so all existing route imports still resolve.

---

### Update 1.3.0 — 2026-03-04

#### Feature: OpenAI Personality Classification Engine
- **Intelligent Archetype Mapping**: Integrated OpenAI's `gpt-4o-mini` into the backend (`personalityAI.js`) to strictly format and classify users based on their self-descriptions.
- **Robust Frontend Processing**: The app now intelligently parses both `snake_case` (raw API) and `camelCase` to map backend AI responses directly into the global user state.
- **Crystallized Data Persistence**: The AI-assigned Character Name, Rank, and Fandom Category are formally saved to the database via a secured endpoint (`/api/auth/profile/:userId/identity`).

#### Critical Refactor: Reliable Push Notifications
- **Centralized Hook Logic**: Completely rebuilt the frontend notification system. Removed the bloated `NotificationHandler` component and consolidated all logic (token registration, background/foreground listeners, and deep routing) into a single pure hook (`useNotifications`).
- **Foreground Alert Banners**: Adjusted `setNotificationHandler` to force the OS to show banners and list items even when the app is actively open and running in the foreground.
- **Background Deliverability (Android/iOS)**: Updated the backend `expoPush.js` utility. The sender payload now includes `_contentAvailable: true`, `mutableContent: true`, `ttl: 0`, and `priority: 'high'` to wake up closed applications and ensure maximum background deliverability.
- **Pre-emptive Android Channels**: Moved Android notification channel creation to immediately execute upon module load, ensuring system queues are ready before registration occurs.

---

### Update 1.2.0 — 2026-03-02

#### Feature: Premium Daily Anime Facts
- **Stable Delivery**: Switched from unstable Heroku-based APIs to **API Ninjas** for guaranteed daily delivery.
- **Dedicated Viewer**: Created a beautiful full-screen modal (`anime-fact.tsx`) to display facts with premium aesthetics, animations, and zero truncation.
- **Deep-Link Integration**: Tapping a fact notification now opens the dedicated viewer instead of just the home feed.
- **Environment Security**: Added `ANIME_FACTS_API_KEY` support in backend `.env`.

#### Feature: Anime Identity & Character Evolution
- **5-Step Onboarding**: Integrated the identity analysis directly into the onboarding flow. Users now describe themselves as the final step.
- **AI-Based Personality Assignment**: Assigns users an Anime Personality Type, Character Match, Fandom Category, and Power Archetype based on their self-description.
- **Rank Progression**: Implemented Rank Tiers (Beginner, Skilled, Elite, S-Class, etc.) that evolve with user activity.

#### Authentication & Reliability Overhaul
- **Fixed Update Notes Logic**: Corrected an issue where update notes would appear multiple times. Dismissal is now strictly persisted per-version.
- **Fixed Redirection Loops**: Resolved "blinking" issues in `AuthLayout` by standardizing path matching and removing group name dependencies.
- **Improved Loading States**: Fixed "stuck loader" bugs by ensuring `isLoading` is explicitly cleared in all authentication success/failure handlers.

#### Notification System Expansion
- **Extended Types**: The notification engine now supports `post_like`, `post_comment`, `dm`, `server_message`, `friend_online`, and `anime_fact`.
- **Backend Campaign Script**: Updated `sendDailyFact.js` to support personalized fetching based on user-selected favorite anime.

---

### Update 1.1.0 — 2026-03-02

#### Major Feature: Streak & XP System (Gamification)
- **Daily Login Streaks**: Users now have a visible streak that increments when they log in daily.
- **XP & Leveling System**: Earn XP for social actions:
    - Creating a post: +20 XP
    - Sending a message/DM: +2 XP
    - Liking a post: +2 XP
    - Commenting on a post: +5 XP
    - Adding a friend: +10 XP
- **Badges**: Users unlock specific badges for streak milestones (5, 10, 30 days) and social milestones (First Friend, Social Butterfly, etc.).
- **Profile Leveling**: Every 100 XP triggers a Level Up with a new badge.

#### Engagement: Push Notification Campaigns
- **Daily Anime Facts**: Automated backend campaign sends an interesting anime fact to all users daily.
- **Friend Activity Alerts**: Notifications are sent to friends when a user comes online (after being offline for >1 hour).
- **Deep-Linking**: Tapping on notifications now intelligently navigates to:
    - User Profiles (for "Friend is online" alerts).
    - Specific Posts (for likes/comments).
    - Chat Channels (for mentions/messages).

#### Critical Fixes & Improvements
- **Fixed "Black Screen" Crash**: Resolved a critical runtime error in `index.tsx` that caused a blank screen after the loader in release APK builds.
- **Explicit Routing**: Converted all router navigation to explicit paths (e.g., `/(tabs)/home`) to ensure reliability in production builds.

---

### Update 1.0.0 — 2026-03-01

#### New Features

**@Mention Users in Posts**
- Type `@` in the post editor to search and tag friends or any user
- Mentioned users receive a push notification
- @mentions render as styled links in the feed
- Backend stores mentioned user IDs in the `mentions` column on `posts` table

**In-App Update Notes ("What's New")**
- A polished modal showing patch notes appears automatically on first login after an update
- Dismissed state is stored per-version in SecureStore — shows only once
- Accessible anytime from **Profile → What's New**
- To add notes for future updates, edit `CURRENT_VERSION` and `UPDATE_NOTES` in `app/components/UpdateNotesModal.tsx`

#### Bug Fixes

**Posts Not Appearing in Feed**
- `POST /api/posts` now sets `is_public` based on visibility and stores `comments_enabled`
- `GET /api/posts` filter updated to include posts where `is_public IS NULL` (legacy posts)
- Frontend invalidates `['posts']` and `['user-posts']` queries after post creation
- Posts query uses `staleTime: 0` and `refetchOnMount: 'always'`

**Duplicate Server Messages**
- `useSocket()` was called from both `_layout.tsx` and `[channelId].tsx`, registering `message:new` listeners twice
- Added a module-level lock (`listenersRegisteredBy`) so socket event listeners register only once globally

**Images Slow to Load in Posts**
- `AutoImage` component now auto-retries failed loads up to 3 times with cache-busting
- Added tap-to-retry on failed images instead of a dead "Image unavailable" placeholder
- Backend upload sets `cacheControl: '3600'` on Supabase Storage for immediate CDN availability

**Friend Request Loading Buttons**
- Per-user loading state tracking in `home.tsx` and `discover.tsx`
- Only the tapped button shows a spinner; other buttons remain interactive

#### Previous Changes (Pre-1.0.0)

- Push notifications — full implementation with Expo Push API, foreground handling, Android channels
- Socket-based server messaging with optimistic UI and deduplication
- Push token registration on login
- Notification tap navigation to DMs, server channels, and notifications screen

---

### Supabase Migrations (Run in SQL Editor)

```sql
-- Add mentions column for @mention feature
ALTER TABLE posts ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}';

-- Add is_public and comments_enabled if missing
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN DEFAULT true;

-- Fix legacy posts with NULL is_public (makes them visible)
UPDATE posts SET is_public = true WHERE is_public IS NULL;
UPDATE posts SET comments_enabled = true WHERE comments_enabled IS NULL;

-- v1.1.0 Streak & XP System
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]';

-- v1.3.0 Anime Identity & Aura
ALTER TABLE users ADD COLUMN IF NOT EXISTS personality_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS character_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fandom_category TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS power_archetype TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rank TEXT;

CREATE INDEX IF NOT EXISTS idx_users_fandom ON public.users(fandom_category);

-- v1.2.0 Notification System Expansion
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('server_added', 'server_approved', 'friend_request', 'general', 'post_like', 'post_comment', 'dm', 'server_message', 'friend_online', 'anime_fact'));
```

---

## Setup

### Prerequisites
- Node.js 18+
- npm
- Expo CLI (`npm install -g expo-cli`)
- An Expo account (for push notifications)

### Frontend (Expo App)
```bash
cd app
npm install
npx expo start
```

### Backend
```bash
cd backend
cp .env.example .env
# Fill in your Supabase URL, keys, JWT secret, etc.
npm install
npm run dev
```

### Environment Variables (Backend .env)
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret
PORT=5000
CLIENT_URL=*
GEMINI_API_KEY=your_google_gemini_api_key
```

---

## Features

- **Authentication** — Email/password, Google OAuth, Discord OAuth
- **User Profiles** — Avatar selection, bio, favorite anime, genres, interests
- **Friend System** — Send/accept/reject friend requests with per-user loading
- **Direct Messaging** — Real-time 1-on-1 chat with image sharing, reactions, replies
- **Servers** — Create/join anime-themed servers with channels
- **Server Chat** — Real-time channel messaging with mentions, reactions, replies
- **Posts** — Create text or image posts with @mentions, tags, categories, and privacy controls
- **Push Notifications** — Friend requests, DMs, server messages, @mentions (Expo Push)
- **In-App Notifications** — Toast-style notifications with navigation
- **Update Notes** — "What's New" modal with version-aware dismissal
- **Gamification** — Daily login streaks, XP system, profile levels, and unlockable badges
- **Automated Campaigns** — Daily anime facts and friend activity push alerts (Backend controlled)
- **Online Status** — Real-time user presence tracking
- **Block/Report** — Block users, report content
- **Server Admin** — Manage members, roles, permissions, join requests

---

## Architecture Notes

### Real-time Communication
- Socket.IO handles all real-time events (messages, typing indicators, online status, notifications)
- The app maintains a persistent socket connection when authenticated
- Socket listeners are registered once globally via a module-level lock in `useSocket.ts`
- Socket disconnects when the app goes to background and reconnects on foreground

### Push Notifications Flow (V3)
1. On login, the app requests notification permission via `expo-device` + `expo-notifications`
2. The Expo push token is sent to the backend and stored in both `push_tokens` table (multi-device) and legacy `users.push_token`
3. When events occur, `notificationController` → `notificationService` → `pushSender` pipeline handles: dedup → rate-limit → DB insert → Socket emit → multi-device push delivery
4. Invalid tokens are auto-cleaned on `DeviceNotRegistered` errors
5. All push activity is audited in `push_send_log` for debugging
6. Tapping a notification navigates to the relevant screen via deep linking

### Message Sending (Server Chat)
- Messages are sent via Socket.IO (`message:send` event), not REST
- Optimistic UI: Messages appear instantly in the chat before server confirmation
- Server persists the message and broadcasts `message:new` to all channel members
- The optimistic message is deduplicated when the real message arrives

### Post Creation Flow
1. User composes post with optional images, tags, @mentions, and privacy settings
2. Images are uploaded to Supabase Storage via `/api/upload` (returns public URLs)
3. Post is created via `POST /api/posts` with `is_public`, `mentions`, and `comments_enabled`
4. Mentioned users receive push notifications
5. Frontend invalidates post queries so the feed updates immediately