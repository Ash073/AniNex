require('dotenv').config();
const { supabase } = require('../src/config/supabase');
const { createDailyFactNotification } = require('../src/utils/notificationHelper');
const { getPersonalizedFact } = require('../src/utils/animeFacts');

async function sendTestFactToUser(username) {
    console.log(`--- Sending Test Anime Fact to ${username} ---`);

    try {
        // Find user by username
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, favorite_anime, push_token')
            .ilike('username', username)
            .single();

        if (error || !user) {
            console.error(`User ${username} not found.`);
            return;
        }

        if (!user.push_token) {
            console.warn(`User ${username} has no push_token. They might not receive it on their device, but it will appear in their notifications.`);
        }

        // Fetch fact based on user preferences
        console.log(`Fetching personalized fact for ${username}...`);
        const fact = await getPersonalizedFact(user.favorite_anime);

        if (fact) {
            console.log(`Fact Content: ${fact}`);
            const result = await createDailyFactNotification(user.id, fact);
            console.log(`Notification Result:`, JSON.stringify(result, null, 2));
            console.log(`Successfully sent test fact to ${username}.`);
        } else {
            console.error('Failed to fetch a fact.');
        }
    } catch (err) {
        console.error('Fatal error:', err.message);
    } finally {
        console.log('--- Test Finished ---');
    }
}

// Get username from command line arguments
const targetUsername = process.argv[2] || 'user1';
sendTestFactToUser(targetUsername);
