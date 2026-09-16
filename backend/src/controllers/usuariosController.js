
const { queryConRLS } = require('../config/db');

const obtenerUsuarios = async (req, res) => {
    const { id_empresa } = req.usuario;
    try {
        const result = await queryConRLS(id_empresa, 'SELECT id_usuario, nombre_completo, correo, rol, fecha_creacion FROM usuarios WHERE estado = TRUE');
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener usuarios." });
    }
};

const actualizarRol = async (req, res) => {
    const { id } = req.params;
    const { rol } = req.body;
    const { id_empresa } = req.usuario;
    try {
        const result = await queryConRLS(id_empresa, 
            'UPDATE usuarios SET rol = $1 WHERE id_usuario = $2 AND estado = TRUE RETURNING id_usuario, nombre_completo, rol',
            [rol, id]
        );
        res.status(200).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar rol." });
    }
};

const eliminarUsuario = async (req, res) => {
    const { id } = req.params;
    const { id_empresa } = req.usuario;
    try {
        await queryConRLS(id_empresa, 'UPDATE usuarios SET estado = FALSE WHERE id_usuario = $1', [id]);
        res.status(200).json({ mensaje: "Usuario dado de baja exitosamente." });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar usuario." });
    }
};

module.exports = { obtenerUsuarios, actualizarRol, eliminarUsuario };
