
const { queryConRLS } = require('../config/db');

const registrarRiesgo = async (req, res) => {
    const { id_hallazgo, probabilidad, impacto } = req.body;
    const { id_empresa } = req.usuario;
    
    // Logica basica de Matriz
    let riesgo_global = 'MEDIO';
    if (probabilidad === 'MUY_ALTA' || impacto === 'CRITICO') riesgo_global = 'ALTO';
    if (probabilidad === 'MUY_ALTA' && impacto === 'CRITICO') riesgo_global = 'CRITICO';

    try {
        const result = await queryConRLS(id_empresa, 
            `INSERT INTO riesgos (id_empresa, id_hallazgo, probabilidad, impacto, riesgo_global) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [id_empresa, id_hallazgo, probabilidad, impacto, riesgo_global]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: "Error al registrar riesgo." });
    }
};

const obtenerRiesgos = async (req, res) => {
    const { id_empresa } = req.usuario;
    try {
        const result = await queryConRLS(id_empresa, 'SELECT * FROM riesgos WHERE estado = TRUE');
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener riesgos." });
    }
};

module.exports = { registrarRiesgo, obtenerRiesgos };
