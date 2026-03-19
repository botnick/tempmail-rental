import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Disable MFA so we can login first
const r = await pool.query(
  "UPDATE user_credentials SET totp_enabled = false, totp_secret = NULL WHERE user_id = (SELECT id FROM users WHERE email = 'admin@tempmail.dev')"
);
console.log('Disabled MFA for admin:', r.rowCount, 'rows');

await pool.end();
