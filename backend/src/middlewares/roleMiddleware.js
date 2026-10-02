/**
 * Middleware para Control de Acceso Basado en Roles y Permisos (RBAC)
 */
const autorizarRoles = (...permisosRequeridos) => {
    return (req, res, next) => {
        if (!req.usuario) return res.status(401).json({ error: "No autenticado" });
        
        const { rol, permisos } = req.usuario;

        // Si es administrador legacy, pasa
        if (rol === 'ADMINISTRADOR' || (permisos && permisos.includes('ALL'))) {
            return next();
        }
        
        // Si tiene el rol legacy o el permiso especifico
        const tieneAcceso = permisosRequeridos.some(p => 
            rol === p || (permisos && permisos.includes(p))
        );

        if (tieneAcceso) {
            return next();
        }

        console.warn(`[SEGURIDAD] Bloqueo: Usuario ${req.usuario.correo} intento acceder a un recurso sin permiso.`);
        return res.status(403).json({ 
            error: "Acceso denegado. Privilegios insuficientes." 
        });
    };
};

module.exports = { autorizarRoles };
