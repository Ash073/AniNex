require('dotenv').config();
const { supabase } = require('../src/config/supabase');
const { sendBulkDailyFacts } = require('../src/controllers/notificationController');
const { getPersonalizedFact } = require('../src/utils/animeFacts');

/**
 * Send personalized daily anime facts to all users with push tokens.
 * Uses bulk notification API with batched Expo push for efficiency.
 */
async function sendDailyFacts() {
  console.log('--- Starting Daily Anime Fact Campaign ---');
  const startTime = Date.now();

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, favorite_anime')
      .not('push_token', 'is', null);

    if (error) throw error;
    if (!users || users.length === 0) {
      console.log('No users with push tokens found.');
      return;
    }

    console.log(`Generating personalized facts for ${users.length} users...`);

    // Generate all facts first
    const userFacts = [];
    for (const user of users) {
      try {
        const fact = await getPersonalizedFact(user.favorite_anime);
        if (fact) {
          userFacts.push({ userId: user.id, fact });
        }
      } catch (err) {
        console.error(`Failed to generate fact for ${user.username}:`, err.message);
      }
    }

    console.log(`Sending ${userFacts.length} facts via bulk API...`);

    // Send all at once using bulk service (handles batching, dedup, rate limits)
    const stats = await sendBulkDailyFacts(userFacts);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Campaign completed in ${elapsed}s:`, stats);
  } catch (err) {
    console.error('Fatal error:', err.message);
  } finally {
    console.log('--- Campaign Finished ---');
  }
}

if (require.main === module) {
  sendDailyFacts().then(() => process.exit(0));
}

module.exports = { sendDailyFacts };
