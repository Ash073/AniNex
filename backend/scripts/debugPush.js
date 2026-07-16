require('dotenv').config();
const { supabase } = require('../src/config/supabase');
const { sendExpoPush } = require('../src/utils/expoPush');
const { createDailyFactNotification } = require('../src/utils/notificationHelper');

async function debugPush(username) {
    console.log(`--- DEBUG PUSH FOR: ${username} ---`);

    const { data: user } = await supabase.from('users').select('id, push_token').ilike('username', username).single();
    if (!user) {
        console.error("USER NOT FOUND");
        return;
    }

    console.log(`Current Token in DB: ${user.push_token}`);
    if (!user.push_token) {
        console.error("USER HAS NO TOKEN. Open the app and log in to register one.");
        return;
    }

    try {
        console.log("Creating notification entry in DB...");
        const notif = await createDailyFactNotification(user.id, "Test Debug Fact @ " + new Date().toLocaleTimeString());
        console.log("DB Notification ID:", notif ? notif.id : "FAILED");

        console.log("Sending Push via Expo...");
        const result = await sendExpoPush(user.push_token, "Debug Notification", "If you see this, tray push is working!", { type: 'test' });
        console.log("EXPO API RESPONSE:", JSON.stringify(result, null, 2));

        if (result.data && result.data.status === 'ok') {
            console.log("SUCCESS: Expo says the message was delivered to their servers.");
            console.log("If it doesn't show in your tray, check phone settings for 'AniNeX' notifications.");
        } else {
            console.log("FAILURE: Expo rejected the request.");
        }
    } catch (e) {
        console.error("CRITICAL ERROR:", e.message);
    }
}

debugPush(process.argv[2] || 'Ash');
