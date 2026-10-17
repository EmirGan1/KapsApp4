import bcrypt from 'bcryptjs';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

async function updatePassword() {
  const username = 'dido';
  const newPassword = 'dido';

  const hashedPassword = bcrypt.hashSync(newPassword, 10);

  try {
    const user = await client.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] });
    if (user.rows.length === 0) {
      console.log('User not found');
      return;
    }
    const userId = user.rows[0].id;
    await client.execute({ sql: 'UPDATE users SET password = ? WHERE id = ?', args: [hashedPassword, userId] });
    console.log('Password updated successfully');
  } catch (error) {
    console.error('Error updating password:', error);
  }
}

updatePassword();
