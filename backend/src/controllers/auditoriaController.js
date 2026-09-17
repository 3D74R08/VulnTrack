const { queryConRLS } = require('../config/db');

const obtenerEventos = async (req, res) => {
    const { id_empresa } = req.usuario;
    const { modulo, dias } = req.query;
    
    try {
        let query = 'SELECT * FROM eventos_auditoria WHERE TRUE';
        const params = [];
        let paramIndex = 1;
        
        if (modulo && modulo !== 'Todos') {
            query += ` AND modulo = $${paramIndex}`;
            params.push(modulo);
            paramIndex++;
        }
        
        if (dias) {
            query += ` AND fecha_evento >= NOW() - INTERVAL '${parseInt(dias)} days'`;
        }
        
        query += ' ORDER BY fecha_evento DESC LIMIT 100';
        
        const result = await queryConRLS(id_empresa, query, params);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("[ERROR AUDITORIA]:", error.message);
        res.status(500).json({ error: "Error al obtener eventos de auditoría." });
    }
};

const registrarEvento = async (req, res) => {
    const { accion, modulo, detalles } = req.body;
    const { id_empresa, id_usuario } = req.usuario;
    
    try {
        const ip_origen = req.ip || req.connection.remoteAddress;
        const result = await queryConRLS(id_empresa,
            `INSERT INTO eventos_auditoria (id_empresa, id_usuario, accion, modulo, detalles, ip_origen)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [id_empresa, id_usuario, accion, modulo, detalles ? JSON.stringify(detalles) : null, ip_origen]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("[ERROR AUDITORIA]:", error.message);
        res.status(500).json({ error: "Error al registrar evento." });
    }
};

module.exports = { obtenerEventos, registrarEvento };
