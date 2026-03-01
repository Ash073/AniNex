const { supabase } = require('../src/config/supabase');
const { createDailyFactNotification } = require('../src/utils/notificationHelper');
const { getPersonalizedFact } = require('../src/utils/animeFacts');

/**
 * Script to send personalized daily anime facts to all users with a push token
 */
async function sendDailyFacts() {
    console.log('--- Starting Personalized Daily Anime Fact Campaign ---');

    try {
        // Get all users who have a push token and their favorite movies/shows
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, favorite_anime')
            .not('push_token', 'is', null);

        if (error) {
            throw error;
        }

        if (!users || users.length === 0) {
            console.log('No users with push tokens found.');
            return;
        }

        console.log(`Sending personalized facts to ${users.length} users...`);

        let successCount = 0;

        // Using for...of instead of map for safer API throttling
        for (const user of users) {
            try {
                // Fetch fact based on user preferences
                const fact = await getPersonalizedFact(user.favorite_anime);

                if (fact) {
                    await createDailyFactNotification(user.id, fact);
                    successCount++;
                }
            } catch (err) {
                console.error(`Failed to send fact to user ${user.username} (${user.id}):`, err.message);
            }
        }

        console.log(`Campaign completed. Successfully sent to ${successCount}/${users.length} users.`);
    } catch (err) {
        console.error('Fatal error in personalized fact campaign:', err.message);
    } finally {
        console.log('--- Campaign Finished ---');
    }
}

// If run directly
if (require.main === module) {
    sendDailyFacts();
}

module.exports = { sendDailyFacts };
