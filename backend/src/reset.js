const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: 'admin_db',
  host: 'securehub-db',
  database: 'securehub',
  password: '3D74R',
  port: 5432,
});

async function resetPass() {
  const hash = bcrypt.hashSync('admin123', 10);
  await pool.query("UPDATE usuarios SET password_hash = $1 WHERE correo = 'admin@acme.com'", [hash]);
  console.log("Updated password to", hash);
  pool.end();
}

resetPass().catch(console.error);
