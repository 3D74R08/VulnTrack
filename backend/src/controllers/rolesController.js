const { queryConRLS } = require('../config/db');
const auditoria = require('../utils/auditoriaHelper');

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
        // No permitir modificar nombre de roles críticos nativos por seguridad, pero sí sus permisos
        if (nombre === 'ADMINISTRADOR') {
            return res.status(400).json({error: "El rol ADMINISTRADOR no puede ser modificado aquí."});
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
        await queryConRLS(id_empresa, 'UPDATE roles_empresa SET estado = FALSE WHERE id_rol = $1', [id]);
        await auditoria.registrarAuditoria(id_empresa, id_usuario, 'ELIMINAR_ROL', 'ROLES', { id_rol: id });
        res.status(200).json({ mensaje: "Rol eliminado." });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar rol." });
    }
};

module.exports = { obtenerRoles, crearRol, actualizarRol, eliminarRol };
