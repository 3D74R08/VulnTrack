/**
 * Backfill idempotente de riesgos y planes de remediacion automaticos.
 *
 * Para datos existentes (anteriores al disparo automatico):
 *  (1) Recalcula el riesgo de las vulnerabilidades con cvss IS NOT NULL y estado=TRUE
 *      cuya evaluacion vigente este AUSENTE o DESALINEADA (prob/impacto esperados != vigente),
 *      reutilizando riesgoService.evaluarRiesgoAutomatico (que archiva la vigente e inserta la nueva).
 *  (2) Crea planes automaticos para las vulnerabilidades ALTA/CRITICA sin plan abierto,
 *      reutilizando remediacionService.crearPlanAutomatico (que es idempotente).
 *
 * Idempotente: una segunda ejecucion no duplica planes ni evaluaciones vigentes
 * (si el riesgo ya esta alineado no se re-inserta, y el plan solo se crea si no hay uno abierto).
 *
 * Uso: docker compose exec securehub-api node src/backfill_riesgos.js
 */
const { pool } = require('./config/db');
const { evaluarRiesgoAutomatico, impactoDesdeCriticidad, probabilidadDesdeCvss, clasificarRiesgo } = require('./services/riesgoService');
const { crearPlanAutomatico } = require('./services/remediacionService');

// Ejecuta la funcion fn dentro de una transaccion con contexto RLS en BYPASS.
const conBypass = async (fn) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_tenant', 'BYPASS', true)");
        const r = await fn(client);
        await client.query('COMMIT');
        return r;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const derivarSeveridadDesdeCvss = (cvss) => {
    const n = cvss ? parseFloat(cvss) : 0;
    if (n >= 9) return 'CRITICA';
    if (n >= 7) return 'ALTA';
    if (n >= 4) return 'MEDIA';
    return 'BAJA';
};

const ejecutar = async () => {
    let recalculadas = 0;
    let planesCreados = 0;

    // Se procesa cada hallazgo en su propia transaccion BYPASS para aislar fallos puntuales.
    const hallazgos = await conBypass(c => c.query(`
        SELECT h.id_hallazgo, h.id_empresa, h.id_activo, h.cve_id, h.cvss, h.severidad,
               a.criticidad, a.codigo_activo,
               r.probabilidad AS prob_vigente, r.impacto AS imp_vigente
        FROM hallazgos_vuln h
        JOIN activos a ON a.id_activo = h.id_activo
        LEFT JOIN riesgos r ON r.id_hallazgo = h.id_hallazgo AND r.estado = TRUE
        WHERE h.cvss IS NOT NULL AND h.estado = TRUE
    `).then(res => res.rows));

    for (const h of hallazgos) {
        const criticidad = h.criticidad || 'BAJA';
        const impEsperado = impactoDesdeCriticidad(criticidad);
        const probEsperada = probabilidadDesdeCvss(h.cvss);
        const clasificacion = clasificarRiesgo(probEsperada, impEsperado);
        const severidad = h.severidad || derivarSeveridadDesdeCvss(h.cvss);

        // Riesgo ausente o desalineado respecto a lo que las formulas producirian hoy.
        const desalineado = h.prob_vigente === null
            || h.prob_vigente !== probEsperada
            || h.imp_vigente !== impEsperado;

        await conBypass(async (c) => {
            const execBypass = (sql, params) => c.query(sql, params);

            if (desalineado) {
                // evaluarRiesgoAutomatico archiva la vigente, inserta la nueva y, si procede,
                // dispara el plan automatico (idempotente) dentro de esta misma transaccion.
                await evaluarRiesgoAutomatico(h.id_empresa, null, h.id_hallazgo,
                    { cvss: h.cvss, criticidad, severidad }, { exec: execBypass });
                recalculadas++;
                // Contabilizar si quedo plan nuevo se hace abajo de forma uniforme; aqui el plan
                // ya pudo crearse. Para no doble-contar, verificamos el plan en el bloque siguiente.
            }

            // Asegurar plan para ALTA/CRITICA aunque el riesgo ya estuviera alineado
            // (p. ej. riesgo correcto pero sin plan). crearPlanAutomatico es idempotente.
            if (['ALTO', 'CRITICO'].includes(clasificacion) || ['ALTA', 'CRITICA'].includes(severidad)) {
                const plan = await crearPlanAutomatico(h.id_empresa, null, {
                    id_hallazgo: h.id_hallazgo, id_activo: h.id_activo, severidad,
                    cve_id: h.cve_id, codigo_activo: h.codigo_activo
                }, { exec: execBypass });
                if (plan) planesCreados++;
            }
        });
    }

    console.log(`[BACKFILL] Hallazgos revisados: ${hallazgos.length}`);
    console.log(`[BACKFILL] Riesgos recalculados: ${recalculadas}`);
    console.log(`[BACKFILL] Planes automaticos creados: ${planesCreados}`);
};

ejecutar()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (e) => {
        console.error('[BACKFILL] Error:', e.message);
        try { await pool.end(); } catch { /* noop */ }
        process.exit(1);
    });
