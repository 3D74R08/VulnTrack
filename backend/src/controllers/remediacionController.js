
const { queryConRLS } = require('../config/db');

const crearPlan = async (req, res) => {
    const { id_hallazgo, id_remediador, plan_accion, fecha_limite } = req.body;
    const { id_empresa } = req.usuario;
    try {
        const result = await queryConRLS(id_empresa, 
            `INSERT INTO planes_remediacion (id_empresa, id_hallazgo, id_remediador, plan_accion, fecha_limite, estado_plan) 
             VALUES ($1, $2, $3, $4, $5, 'PENDIENTE') RETURNING *`,
            [id_empresa, id_hallazgo, id_remediador, plan_accion, fecha_limite]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error al crear plan de remediación." });
    }
};

const obtenerPlanes = async (req, res) => {
    const { id_empresa } = req.usuario;
    try {
        const result = await queryConRLS(id_empresa, 'SELECT * FROM planes_remediacion WHERE estado = TRUE');
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener planes." });
    }
};

module.exports = { crearPlan, obtenerPlanes };
