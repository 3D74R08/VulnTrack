const { queryConRLS } = require('../config/db');
const bcrypt = require('bcryptjs');
const auditoria = require('../utils/auditoriaHelper');

const obtenerUsuarios = async (req, res) => {
    const { id_empresa } = req.usuario;
    try {
        const result = await queryConRLS(id_empresa, 'SELECT id_usuario, nombre_completo, correo, rol, fecha_creacion FROM usuarios WHERE estado = TRUE');
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener usuarios." });
    }
};

const crearUsuario = async (req, res) => {
    const { nombre_completo, correo, password, rol } = req.body;
    const { id_empresa, id_usuario } = req.usuario;
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const result = await queryConRLS(id_empresa,
            'INSERT INTO usuarios (id_empresa, nombre_completo, correo, password_hash, rol) VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario, correo',
            [id_empresa, nombre_completo, correo, hash, rol]
        );
        
        await auditoria.registrarAuditoria(id_empresa, id_usuario, 'CREAR_USUARIO', 'USUARIOS', { correo, rol });
        res.status(201).json({ mensaje: "Usuario creado", usuario: result.rows[0] });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') return res.status(400).json({ error: "El correo ya está en uso." });
        res.status(500).json({ error: "Error al crear usuario." });
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

module.exports = { obtenerUsuarios, crearUsuario, actualizarRol, eliminarUsuario };
