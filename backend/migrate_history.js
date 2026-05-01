/**
 * One-time migration: creates the task_history table in Supabase.
 * Run with: node migrate_history.js
 */
require('dotenv').config({ path: '../.env' });
const supabase = require('./supabase');

async function migrate() {
  console.log('Creating task_history table...');

  const { error } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS task_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_name TEXT NOT NULL DEFAULT '',
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_history_created_at ON task_history(created_at DESC);
    `
  });

  if (error) {
    // rpc may not exist — try raw SQL via REST
    console.log('RPC not available, trying direct table creation via Supabase client...');
    console.log('Please run this SQL in your Supabase SQL Editor:');
    console.log(`
CREATE TABLE IF NOT EXISTS task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT '',
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_created_at ON task_history(created_at DESC);
    `);

    // Try inserting a test row to check if table already exists
    const { error: testErr } = await supabase
      .from('task_history')
      .select('id')
      .limit(1);

    if (testErr && testErr.code === '42P01') {
      console.error('\n❌ Table does not exist. Please run the SQL above in your Supabase Dashboard → SQL Editor.');
      process.exit(1);
    } else if (!testErr) {
      console.log('✅ task_history table already exists!');
    }
  } else {
    console.log('✅ task_history table created successfully!');
  }

  process.exit(0);
}

migrate();
