const { registrarAuditoria } = require('../utils/auditoriaHelper');
const { queryConRLS } = require('../config/db');
const { expandirPermisos } = require('../utils/permisos');

/**
 * Middleware de autorización por permisos granulares (RBAC dinámico).
 * Se valida SIEMPRE en backend, sin importar lo que muestre el frontend (Sección 44).
 * Si se deniega: HTTP 403 + evento PERMISSION_DENIED (Sección 10).
 */
const autorizarRoles = (...permisosRequeridos) => {
    return async (req, res, next) => {
        if (!req.usuario) return res.status(401).json({ error: "No autenticado" });

        try {
            // Leer el rol y sus permisos actuales evita mantener autorizaciones
            // obsoletas dentro del JWT hasta que expire.
            const acceso = await queryConRLS(
                req.usuario.id_empresa,
                `SELECT u.rol, r.permisos
                 FROM usuarios u
                 LEFT JOIN roles_empresa r
                   ON r.id_empresa = u.id_empresa AND r.nombre = u.rol AND r.estado = TRUE
                 WHERE u.id_usuario = $1 AND u.id_empresa = $2 AND u.estado = TRUE`,
                [req.usuario.id_usuario, req.usuario.id_empresa]
            );
            if (acceso.rows.length === 0) {
                return res.status(401).json({ error: 'La sesión ya no corresponde a un usuario activo.' });
            }

            const { rol, permisos: permisosDb } = acceso.rows[0];
            const permisos = rol === 'ADMINISTRADOR'
                ? ['ALL']
                : (Array.isArray(permisosDb) ? permisosDb.filter(p => p !== 'ALL') : []);
            req.usuario.rol = rol;
            req.usuario.permisos = permisos;

            if (rol === 'ADMINISTRADOR') return next();

            const permisosCompatibles = new Set(expandirPermisos(permisos));
            const tieneAcceso = permisosRequeridos.some(p => permisosCompatibles.has(p));
            if (tieneAcceso) return next();
        } catch (error) {
            console.error('[ERROR AUTORIZAR PERMISOS]:', error.message);
            return res.status(500).json({ error: 'No se pudieron verificar los permisos.' });
        }

        console.warn(`[SEGURIDAD] PERMISSION_DENIED: ${req.usuario.correo} -> ${req.method} ${req.originalUrl}`);
        await registrarAuditoria(req.usuario.id_empresa, req.usuario.id_usuario, 'PERMISSION_DENIED', 'Seguridad',
            { metodo: req.method, ruta: req.originalUrl, requeridos: permisosRequeridos }, req.ip,
            { recurso: 'endpoint', id_recurso: `${req.method} ${req.baseUrl}${req.route?.path || ''}`, resultado: 'DENEGADO',
              descripcion: `Acceso denegado a ${req.method} ${req.originalUrl}` });
        return res.status(403).json({ error: "Acceso denegado. Privilegios insuficientes." });
    };
};

module.exports = { autorizarRoles };
