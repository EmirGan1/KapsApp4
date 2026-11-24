import 'dotenv/config';
import { createClient } from '@libsql/client';
import { resolveScriptDatabaseConfig } from './lib/db-url.mjs';

const dbConfig = resolveScriptDatabaseConfig();
const client = createClient({
  url: dbConfig.url,
  authToken: dbConfig.authToken,
});

async function listTables() {
  try {
    console.log(`Connected to: ${dbConfig.filePath ?? dbConfig.url} (source: ${dbConfig.source})`);
    const res = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
    console.log('Tables:', res.rows.map((r) => r.name));
  } catch (error) {
    console.error('Error:', error);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

listTables();
