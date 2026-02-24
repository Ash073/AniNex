const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test the connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error && error.code === '42P01') {
      console.log('Supabase connected (tables need to be created - run migration)');
    } else if (error) {
      console.log('Supabase connected (note:', error.message, ')');
    } else {
      console.log('Supabase Connected successfully');
    }
  } catch (err) {
    console.error('Supabase connection test failed:', err.message);
  }
};

module.exports = { supabase, testConnection };
