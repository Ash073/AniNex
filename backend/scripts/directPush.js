require('dotenv').config();
const { supabase } = require('../src/config/supabase');
const { sendExpoPush } = require('../src/utils/expoPush');

async function testDirectPush(username) {
    const { data: user } = await supabase.from('users').select('push_token').ilike('username', username).single();
    if (!user || !user.push_token) {
        console.log("No token found");
        return;
    }
    console.log("Token:", user.push_token);
    try {
        const result = await sendExpoPush(
            user.push_token,
            "Direct Test",
            "Test Body " + Date.now(),
            { type: 'test' }
        );
        console.log("Expo API Response:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e);
    }
}

testDirectPush('Ash');
