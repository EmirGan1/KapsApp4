import { createClient } from '@libsql/client';

const client = createClient({
  url: 'file:local.db',
});

async function listTables() {
  try {
    const res = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
    console.log('Tables:', res.rows.map(r => r.name));
  } catch (error) {
    console.error('Error:', error);
  }
}

listTables();
