const { queryConRLS } = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoriaHelper');

const crearActivo = async (req, res) => {
    let { nombre, tipo, criticidad, propietario } = req.body;
    const { id_empresa, id_usuario } = req.usuario; // Extraído del token JWT por el middleware

    if (!nombre || !tipo) {
        return res.status(400).json({ error: "El nombre y el tipo de activo son obligatorios." });
    }
    
    const critMap = { 'HIGH': 'ALTA', 'MEDIUM': 'MEDIA', 'LOW': 'BAJA' };
    if (critMap[criticidad]) criticidad = critMap[criticidad];

    try {
        // queryConRLS inyecta id_empresa en la sesión de Postgres para el aislamiento
        const result = await queryConRLS(id_empresa, 
            `INSERT INTO activos (id_empresa, nombre, tipo, criticidad, propietario) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [id_empresa, nombre, tipo, criticidad || 'MEDIA', propietario || 'No asignado']
        );
        const activo = result.rows[0];
        await registrarAuditoria(id_empresa, id_usuario, 'Registró activo', 'Activos', { id_activo: activo.id_activo, nombre }, req.ip);
        res.status(201).json(activo);
    } catch (error) {
        console.error("[ERROR CREAR ACTIVO]:", error.message);
        res.status(500).json({ error: "Fallo al crear el activo." });
    }
};

const obtenerActivos = async (req, res) => {
    const { id_empresa } = req.usuario;
    try {
        // La política RLS ya filtra automáticamente por id_empresa
        // Añadimos "estado = TRUE" por la regla de Soft Delete (ocultar inactivos)
        const result = await queryConRLS(id_empresa, 
            `SELECT * FROM activos WHERE estado = TRUE ORDER BY fecha_creacion DESC`
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("[ERROR OBTENER ACTIVOS]:", error.message);
        res.status(500).json({ error: "Fallo al obtener los activos." });
    }
};

const actualizarActivo = async (req, res) => {
    const { id } = req.params;
    const { nombre, tipo, criticidad, propietario } = req.body;
    const { id_empresa } = req.usuario;

    try {
        const result = await queryConRLS(id_empresa,
            `UPDATE activos 
             SET nombre = COALESCE($1, nombre),
                 tipo = COALESCE($2, tipo),
                 criticidad = COALESCE($3, criticidad),
                 propietario = COALESCE($4, propietario)
             WHERE id_activo = $5 AND estado = TRUE
             RETURNING *`,
            [nombre, tipo, criticidad, propietario, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Activo no encontrado o no tienes permisos." });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error("[ERROR ACTUALIZAR ACTIVO]:", error.message);
        res.status(500).json({ error: "Fallo al actualizar el activo." });
    }
};

const eliminarActivo = async (req, res) => {
    const { id } = req.params;
    const { id_empresa } = req.usuario;

    try {
        // SOFT DELETE: En lugar de "DELETE FROM activos", actualizamos el estado a FALSE
        const result = await queryConRLS(id_empresa,
            `UPDATE activos SET estado = FALSE WHERE id_activo = $1 AND estado = TRUE RETURNING id_activo`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Activo no encontrado o ya estaba inactivo." });
        }
        res.status(200).json({ mensaje: "Activo dado de baja (Soft Delete) exitosamente." });
    } catch (error) {
        console.error("[ERROR ELIMINAR ACTIVO]:", error.message);
        res.status(500).json({ error: "Fallo al dar de baja el activo." });
    }
};

module.exports = { crearActivo, obtenerActivos, actualizarActivo, eliminarActivo };
