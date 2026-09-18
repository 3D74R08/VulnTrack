/**
 * Middleware para Control de Acceso Basado en Roles (RBAC)
 * @param  {...string} rolesPermitidos - Lista de roles que pueden acceder a la ruta
 */
const autorizarRoles = (...rolesPermitidos) => {
    return (req, res, next) => {
        // req.usuario ya fue inyectado previamente por el authMiddleware
        if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
            console.warn(`[SEGURIDAD] Bloqueo RBAC: Usuario rol ${req.usuario?.rol} intentó evadir privilegios.`);
            return res.status(403).json({ 
                error: "Acceso denegado. Privilegios insuficientes para esta operación." 
            });
        }
        next(); // El usuario tiene el rol correcto, pasa al controlador
    };
};

module.exports = { autorizarRoles };
