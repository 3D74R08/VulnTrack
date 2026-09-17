const { queryConRLS } = require('../config/db');

const obtenerMetricas = async (req, res) => {
    const { id_empresa } = req.usuario;

    try {
        // 1. Conteo de Activos
        const activosRes = await queryConRLS(id_empresa, 
            'SELECT COUNT(*) as total FROM activos WHERE estado = TRUE'
        );
        const totalActivos = parseInt(activosRes.rows[0].total, 10);

        // 2. Conteo de Hallazgos por Severidad
        const severidadRes = await queryConRLS(id_empresa, 
            `SELECT severidad, COUNT(*) as cantidad 
             FROM hallazgos_vuln 
             WHERE estado = TRUE 
             GROUP BY severidad`
        );
        const hallazgosPorSeveridad = severidadRes.rows;

        // 3. Estado de los Planes de Remediación
        const remediacionRes = await queryConRLS(id_empresa, 
            `SELECT estado_plan, COUNT(*) as cantidad 
             FROM planes_remediacion 
             WHERE estado = TRUE 
             GROUP BY estado_plan`
        );
        const planesPorEstado = remediacionRes.rows;

        // 4. Últimos 5 Hallazgos Críticos o Altos (Para una tabla rápida en el Dashboard)
        const topHallazgosRes = await queryConRLS(id_empresa, 
            `SELECT titulo, severidad, estado_hallazgo, fecha_descubrimiento 
             FROM hallazgos_vuln 
             WHERE estado = TRUE AND (severidad = 'CRITICAL' OR severidad = 'HIGH')
             ORDER BY fecha_descubrimiento DESC 
             LIMIT 5`
        );
        const alertasRecientes = topHallazgosRes.rows;

        // Ensamblar y enviar el JSON consolidado
        res.status(200).json({
            metricas_generales: {
                total_activos: totalActivos
            },
            graficas: {
                hallazgos_severidad: hallazgosPorSeveridad,
                estado_remediacion: planesPorEstado
            },
            alertas_recientes: alertasRecientes
        });

    } catch (error) {
        console.error("[ERROR DASHBOARD]:", error.message);
        res.status(500).json({ error: "Fallo interno al generar métricas del Dashboard." });
    }
};

module.exports = { obtenerMetricas };
