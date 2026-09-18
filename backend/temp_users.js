const bcrypt = require('bcryptjs');
const { Client } = require('pg');
(async () => {
    const client = new Client('postgresql://admin_db:securepwd@localhost:5432/securehub');
    await client.connect();
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('Seguridad2026', salt);
    const id = (await client.query('SELECT id_empresa FROM empresas LIMIT 1')).rows[0].id_empresa;
    
    await client.query('INSERT INTO usuarios (id_empresa, nombre_completo, correo, password_hash, rol, estado, mfa_enabled) VALUES ($1, $2, $3, $4, $5, true, false) ON CONFLICT DO NOTHING', [id, 'Auditor Pentester', 'auditor@acme.com', hash, 'AUDITOR']);
    
    await client.query('INSERT INTO usuarios (id_empresa, nombre_completo, correo, password_hash, rol, estado, mfa_enabled) VALUES ($1, $2, $3, $4, $5, true, false) ON CONFLICT DO NOTHING', [id, 'Desarrollador SysAdmin', 'dev@acme.com', hash, 'REMEDIADOR']);
    
    console.log('OK');
    process.exit(0);
})();
