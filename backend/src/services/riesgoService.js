const { queryConRLS } = require('../config/db');

/**
 * SLA (en dias) por severidad de la vulnerabilidad. Se definen los 4 niveles
 * aunque hoy solo ALTA/CRITICA disparen un plan automatico, para que el calculo
 * de fecha_limite sea coherente si en el futuro se amplia el disparo.
 */
const SLA_DIAS_POR_SEVERIDAD = { CRITICA: 7, ALTA: 15, MEDIA: 30, BAJA: 90 };

/**
 * Deriva el impacto (1-5) a partir de la criticidad del activo.
 * Misma formula que existia inline en vulnerabilidadService.js.
 */
const impactoDesdeCriticidad = (criticidad) => {
    const crit = criticidad || 'BAJA';
    if (crit === 'CRITICA') return 5;
    if (crit === 'ALTA') return 4;
    if (crit === 'MEDIA') return 3;
    return 2; // BAJA / desconocida
};

/**
 * Deriva la probabilidad (1-5) a partir del CVSS.
 * cvss null/0 -> 2. Misma formula que existia inline en vulnerabilidadService.js.
 */
const probabilidadDesdeCvss = (cvss) => {
    const cvssNum = cvss ? parseFloat(cvss) : 0;
    if (cvssNum >= 9) return 5;
    if (cvssNum >= 7) return 4;
    if (cvssNum >= 4) return 3;
    return 2;
};

/**
 * Clasifica el riesgo con el MISMO umbral que la columna GENERATED de la BD
 * (puntaje = probabilidad * impacto).
 */
const clasificarRiesgo = (probabilidad, impacto) => {
    const puntaje = probabilidad * impacto;
    if (puntaje >= 17) return 'CRITICO';
    if (puntaje >= 10) return 'ALTO';
    if (puntaje >= 5) return 'MEDIO';
    return 'BAJO';
};

/**
 * Deriva una severidad coherente (ALTA/CRITICA) cuando el llamador no la pasa,
 * para poder decidir el disparo del plan automatico. Prioriza el CVSS; si no hay,
 * usa la clasificacion resultante.
 */
const derivarSeveridad = (cvss, clasificacion) => {
    const cvssNum = cvss ? parseFloat(cvss) : 0;
    if (cvssNum >= 9) return 'CRITICA';
    if (cvssNum >= 7) return 'ALTA';
    if (cvssNum >= 4) return 'MEDIA';
    if (cvssNum > 0) return 'BAJA';
    // Sin CVSS: inferir desde la clasificacion del riesgo
    if (clasificacion === 'CRITICO') return 'CRITICA';
    if (clasificacion === 'ALTO') return 'ALTA';
    if (clasificacion === 'MEDIO') return 'MEDIA';
    return 'BAJA';
};

/**
 * Evalua el riesgo de un hallazgo de forma automatica y, si corresponde, dispara
 * la creacion del plan de remediacion automatico.
 *
 * Centraliza la logica que antes vivia inline en vulnerabilidadService.js para que
 * los 3 origenes (creacion, worker NVD y reenriquecer manual) recalculen igual.
 *
 * @param {string} id_empresa - UUID del tenant.
 * @param {string|null} id_usuario - Quien evalua; NULL cuando lo hace el worker.
 * @param {string} id_hallazgo - UUID del hallazgo a evaluar.
 * @param {{cvss?: number|null, criticidad?: string, severidad?: string}} datos
 * @param {{exec?: Function}} opciones - Ejecutor de query inyectable (sql, params).
 *        Por defecto usa queryConRLS ligado al tenant (RLS). El worker inyecta un
 *        wrapper que usa su client en BYPASS para compartir la misma transaccion.
 * @returns {Promise<{clasificacion: string, probabilidad: number, impacto: number}>}
 */
const evaluarRiesgoAutomatico = async (id_empresa, id_usuario, id_hallazgo, datos = {}, opciones = {}) => {
    // Ejecutor por defecto: queryConRLS atado al tenant. El worker (BYPASS) o
    // cualquier otro llamador puede inyectar su propio 'exec' para compartir contexto.
    const exec = opciones.exec || ((sql, params) => queryConRLS(id_empresa, sql, params));

    const impacto = impactoDesdeCriticidad(datos.criticidad);
    const probabilidad = probabilidadDesdeCvss(datos.cvss);
    const cvssNum = datos.cvss ? parseFloat(datos.cvss) : 0;
    const justificacion = `Auto-Evaluación (Criticidad: ${datos.criticidad || 'BAJA'}, CVSS: ${cvssNum})`;

    // (a) Archivar la evaluacion vigente para respetar el indice uq_riesgo_vigente.
    await exec('UPDATE riesgos SET estado = FALSE WHERE id_hallazgo = $1 AND estado = TRUE', [id_hallazgo]);

    // (b) Insertar la nueva evaluacion. NO se insertan puntaje ni clasificacion:
    // son columnas GENERATED en la BD. evaluado_por puede ser NULL (worker).
    await exec(
        `INSERT INTO riesgos (id_empresa, id_hallazgo, probabilidad, impacto, justificacion, evaluado_por)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id_empresa, id_hallazgo, probabilidad, impacto, justificacion, id_usuario]);

    const clasificacion = clasificarRiesgo(probabilidad, impacto);

    // --- DISPARO DEL PLAN DE REMEDIACION AUTOMATICO ---
    // Ocurre AQUI porque este helper es el unico punto por el que pasan los 3 origenes
    // de evaluacion, garantizando que un riesgo ALTO/CRITICO siempre considere un plan.
    // require perezoso para evitar la dependencia circular riesgo <-> remediacion.
    const severidad = datos.severidad || derivarSeveridad(datos.cvss, clasificacion);
    if (['ALTO', 'CRITICO'].includes(clasificacion) || ['ALTA', 'CRITICA'].includes(severidad)) {
        const { crearPlanAutomatico } = require('./remediacionService');
        // Se pasa el MISMO 'exec' para respetar el contexto (BYPASS en worker, RLS en controllers).
        await crearPlanAutomatico(id_empresa, id_usuario, {
            id_hallazgo, severidad, cvss: datos.cvss
        }, { exec });
    }

    return { clasificacion, probabilidad, impacto };
};

module.exports = {
    SLA_DIAS_POR_SEVERIDAD,
    evaluarRiesgoAutomatico,
    impactoDesdeCriticidad,
    probabilidadDesdeCvss,
    clasificarRiesgo,
};
