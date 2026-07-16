require('dotenv').config();
const { supabase } = require('../src/config/supabase');

async function listUsers() {
    const { data: users, error } = await supabase
        .from('users')
        .select('username')
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Top 10 users:');
    users.forEach(u => console.log(`- ${u.username}`));
}

listUsers();
