const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const bootstrapDemoAdmin = async () => {
    if (process.env.DEMO_ADMIN_ENABLED !== 'true') return;

    const nombre = (process.env.DEMO_ADMIN_NAME || '').trim();
    const correo = (process.env.DEMO_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.DEMO_ADMIN_PASSWORD;

    if (!nombre || !correo || !password) {
        throw new Error('DEMO_ADMIN_NAME, DEMO_ADMIN_EMAIL y DEMO_ADMIN_PASSWORD son obligatorios cuando DEMO_ADMIN_ENABLED=true.');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_tenant', 'BYPASS', true)");
        await client.query("SELECT pg_advisory_xact_lock(hashtext('vulntrack_demo_admin_bootstrap'))");

        const existente = await client.query(
            'SELECT id_usuario FROM usuarios WHERE lower(correo) = lower($1) LIMIT 1',
            [correo]
        );

        if (existente.rows.length > 0) {
            await client.query('COMMIT');
            console.log('[BOOTSTRAP] La cuenta de demostración ya existe; no se modificó.');
            return;
        }

        const empresa = await client.query(
            'INSERT INTO empresas (nombre_empresa) VALUES ($1) RETURNING id_empresa',
            [`VulnTrack - ${nombre}`]
        );
        const idEmpresa = empresa.rows[0].id_empresa;

        await client.query(
            `INSERT INTO roles_empresa (id_empresa, nombre, descripcion, permisos) VALUES
                ($1, 'ADMINISTRADOR', 'Acceso total al sistema', '["ALL"]'::jsonb),
                ($1, 'AUDITOR', 'Consulta y registro de vulnerabilidades',
                    '["VER_ACTIVOS", "VER_VULN", "CREAR_VULN", "VER_RIESGOS"]'::jsonb),
                ($1, 'REMEDIADOR', 'Gestión de planes de remediación',
                    '["VER_ACTIVOS", "VER_VULN", "GESTIONAR_REMEDIACION"]'::jsonb)`,
            [idEmpresa]
        );

        const passwordHash = await bcrypt.hash(password, 10);
        await client.query(
            `INSERT INTO usuarios (id_empresa, nombre_completo, correo, password_hash, rol)
             VALUES ($1, $2, $3, $4, 'ADMINISTRADOR')`,
            [idEmpresa, nombre, correo, passwordHash]
        );

        await client.query('COMMIT');
        console.log('[BOOTSTRAP] Se creó la cuenta de demostración configurada en el entorno.');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { bootstrapDemoAdmin };
