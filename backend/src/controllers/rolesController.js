const { queryConRLS } = require('../config/db');
const auditoria = require('../utils/auditoriaHelper');
const { PERMISOS_VALIDOS, expandirPermisos } = require('../utils/permisos');

const validarPermisos = (permisos, actorPermisos) => {
    if (!Array.isArray(permisos) || permisos.some(p => typeof p !== 'string' || !PERMISOS_VALIDOS.has(p))) {
        return 'La lista de permisos contiene valores no válidos.';
    }
    const permisosActorExpandidos = expandirPermisos(actorPermisos);
    const esAdmin = permisosActorExpandidos.includes('ALL');
    if (!esAdmin && permisos.some(p => !permisosActorExpandidos.includes(p))) {
        return 'No puedes asignar permisos que tu usuario no posee.';
    }
    return null;
};

const obtenerRoles = async (req, res) => {
    const { id_empresa } = req.usuario;
    try {
        const result = await queryConRLS(id_empresa, 'SELECT id_rol, nombre, descripcion, permisos, estado, fecha_creacion FROM roles_empresa WHERE estado = TRUE');
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener roles." });
    }
};

const crearRol = async (req, res) => {
    const { nombre, descripcion, permisos } = req.body;
    const { id_empresa, id_usuario } = req.usuario;
    const errorPermisos = validarPermisos(permisos || [], req.usuario.permisos || []);
    if (errorPermisos) return res.status(400).json({ error: errorPermisos });
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre del rol es obligatorio.' });
    try {
        const result = await queryConRLS(id_empresa,
            'INSERT INTO roles_empresa (id_empresa, nombre, descripcion, permisos) VALUES ($1, $2, $3, $4) RETURNING *',
            [id_empresa, nombre, descripcion, JSON.stringify(permisos || [])]
        );
        await auditoria.registrarAuditoria(id_empresa, id_usuario, 'CREAR_ROL', 'ROLES', { nombre });
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al crear rol." });
    }
};

const actualizarRol = async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, permisos } = req.body;
    const { id_empresa, id_usuario } = req.usuario;
    try {
        const errorPermisos = validarPermisos(permisos, req.usuario.permisos || []);
        if (errorPermisos) return res.status(400).json({ error: errorPermisos });
        if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre del rol es obligatorio.' });

        const actual = await queryConRLS(id_empresa,
            'SELECT nombre FROM roles_empresa WHERE id_rol = $1 AND estado = TRUE', [id]);
        if (actual.rows.length === 0) return res.status(404).json({ error: 'Rol no encontrado.' });
        if (actual.rows[0].nombre === 'ADMINISTRADOR') {
            return res.status(400).json({ error: 'El rol ADMINISTRADOR no puede modificarse.' });
        }

        const result = await queryConRLS(id_empresa, 
            'UPDATE roles_empresa SET nombre = $1, descripcion = $2, permisos = $3 WHERE id_rol = $4 AND estado = TRUE RETURNING *',
            [nombre, descripcion, JSON.stringify(permisos), id]
        );
        await auditoria.registrarAuditoria(id_empresa, id_usuario, 'EDITAR_ROL', 'ROLES', { nombre });
        res.status(200).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar rol." });
    }
};

const eliminarRol = async (req, res) => {
    const { id } = req.params;
    const { id_empresa, id_usuario } = req.usuario;
    try {
        const result = await queryConRLS(id_empresa,
            `UPDATE roles_empresa SET estado = FALSE
             WHERE id_rol = $1 AND estado = TRUE AND nombre <> 'ADMINISTRADOR'
             RETURNING nombre`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Rol no encontrado o protegido.' });
        await auditoria.registrarAuditoria(id_empresa, id_usuario, 'ELIMINAR_ROL', 'ROLES', { id_rol: id });
        res.status(200).json({ mensaje: "Rol eliminado." });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar rol." });
    }
};

module.exports = { obtenerRoles, crearRol, actualizarRol, eliminarRol };
