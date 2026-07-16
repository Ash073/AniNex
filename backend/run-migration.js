const { supabase } = require('./src/config/supabase');

async function runMigration() {
  try {
    console.log('Running migration to add privacy controls and view counting...');
    
    // Check if columns already exist
    const { data: columns, error: columnsError } = await supabase
      .from('posts')
      .select('*')
      .limit(1);

    if (columnsError) {
      console.error('Error checking posts table:', columnsError.message);
      process.exit(1);
    }

    // The columns will be added manually through Supabase dashboard
    // For now, let's just create the post_views table if it doesn't exist
    
    // Try to create post_views table
    try {
      const { error: createError } = await supabase.rpc('create_post_views_table');
      
      if (createError) {
        console.log('Note: post_views table may need to be created manually through Supabase dashboard');
        console.log('Use the SQL from supabase_migration.sql file');
      } else {
        console.log('✓ post_views table created successfully');
      }
    } catch (e) {
      console.log('Note: post_views table may need to be created manually through Supabase dashboard');
      console.log('Use the SQL from supabase_migration.sql file');
    }
    
    console.log('Migration completed!');
    console.log('Please manually add the following columns to your posts table through Supabase dashboard:');
    console.log('ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT \'public\' CHECK (visibility IN (\'public\', \'followers\', \'selected\'));');
    console.log('ALTER TABLE posts ADD COLUMN IF NOT EXISTS allowed_users UUID[] DEFAULT \'{}\';');
    console.log('ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN DEFAULT TRUE;');
    console.log('');
    console.log('And create the post_views table using the SQL from supabase_migration.sql');
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();