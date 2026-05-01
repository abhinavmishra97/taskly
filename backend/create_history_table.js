require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  db: { schema: 'public' }
});

const sql = [
  `CREATE TABLE IF NOT EXISTS task_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL DEFAULT '',
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id)`,
  `CREATE INDEX IF NOT EXISTS idx_task_history_created_at ON task_history(created_at DESC)`
];

async function run() {
  // The service_role key has admin privileges, try the SQL API
  const baseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  for (const statement of sql) {
    const resp = await fetch(baseUrl + '/rest/v1/rpc/', {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({})
    });
  }

  // Direct approach: use the Supabase SQL query endpoint  
  const fullSql = sql.join(';\n') + ';';
  
  const resp = await fetch(baseUrl + '/pg/query', {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: fullSql })
  });
  
  if (resp.ok) {
    console.log('✅ Table created via pg/query endpoint');
    return;
  }

  // Try the /sql endpoint
  const resp2 = await fetch(baseUrl + '/sql', {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: fullSql })
  });

  if (resp2.ok) {
    console.log('✅ Table created via /sql endpoint');
    return;
  }

  console.log('Could not create table automatically.');
  console.log('Status pg/query:', resp.status);
  console.log('Status /sql:', resp2.status);
  
  // Last resort: check if table exists
  const { error } = await supabase.from('task_history').select('id').limit(1);
  if (error) {
    console.log('\nTable does NOT exist yet. Run this SQL in Supabase Dashboard > SQL Editor:');
    console.log('\n' + fullSql);
  } else {
    console.log('\n✅ Table already exists!');
  }
}

run().catch(console.error);
