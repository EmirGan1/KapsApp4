import bcrypt from 'bcryptjs';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { resolveScriptDatabaseConfig } from './lib/db-url.mjs';

dotenv.config();

const [username, newPassword] = process.argv.slice(2);
if (!username || !newPassword) {
  console.error('Usage: node scripts/update-password.js <username> <newPassword>');
  process.exit(1);
}

const dbConfig = resolveScriptDatabaseConfig();
const client = createClient({
  url: dbConfig.url,
  authToken: dbConfig.authToken,
});

async function updatePassword() {
  const hashedPassword = bcrypt.hashSync(newPassword, 10);

  try {
    const user = await client.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] });
    if (user.rows.length === 0) {
      console.log('User not found');
      process.exitCode = 1;
      return;
    }
    const userId = user.rows[0].id;
    await client.execute({ sql: 'UPDATE users SET password = ? WHERE id = ?', args: [hashedPassword, userId] });
    console.log(`Password updated successfully (${dbConfig.filePath ?? dbConfig.url})`);
  } catch (error) {
    console.error('Error updating password:', error);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

updatePassword();
