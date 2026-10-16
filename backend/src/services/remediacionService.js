const { queryConRLS } = require('../config/db');
const { SLA_DIAS_POR_SEVERIDAD } = require('./riesgoService');

const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];

/**
 * Crea un plan de remediacion AUTOMATICO para un hallazgo ALTA/CRITICA.
 *
 * Reglas de negocio confirmadas:
 *  - estado_plan = 'PENDIENTE', id_remediador = NULL (no se auto-asigna responsable).
 *  - fecha_limite = CURRENT_DATE + SLA segun severidad (CRITICA=7, ALTA=15, MEDIA=30, BAJA=90).
 *  - Las evidencias y la ejecucion de la remediacion siguen siendo MANUALES.
 *
 * Es IDEMPOTENTE: si ya existe un plan abierto para ese hallazgo, no crea otro (devuelve null).
 *
 * @param {string} id_empresa
 * @param {string|null} id_usuario - creado_por; NULL cuando lo dispara el worker.
 * @param {{id_hallazgo: string, id_activo?: string, severidad?: string, cve_id?: string, codigo_activo?: string}} datos
 * @param {{exec?: Function}} opciones - Ejecutor de query inyectable (sql, params),
 *        por defecto queryConRLS atado al tenant. El worker inyecta su client BYPASS.
 * @returns {Promise<object|null>} el plan creado, o null si ya existia uno abierto.
 */
const crearPlanAutomatico = async (id_empresa, id_usuario, datos, opciones = {}) => {
    const exec = opciones.exec || ((sql, params) => queryConRLS(id_empresa, sql, params));

    // Idempotencia: no crear si ya hay un plan abierto que cubra este hallazgo.
    const abierto = await exec(
        `SELECT 1 FROM plan_vulnerabilidades pv
         JOIN planes_remediacion p ON p.id_plan = pv.id_plan
         WHERE pv.id_hallazgo = $1 AND pv.estado = TRUE AND p.estado = TRUE
           AND p.estado_plan NOT IN ('COMPLETADO','CANCELADO')`, [datos.id_hallazgo]);
    if (abierto.rows.length > 0) return null;

    // Completar datos que el llamador pueda no haber pasado (worker solo pasa id_hallazgo).
    let { id_activo, cve_id, codigo_activo } = datos;
    if (!cve_id || !codigo_activo || !id_activo) {
        const info = await exec(
            `SELECT h.id_activo, h.cve_id, a.codigo_activo
             FROM hallazgos_vuln h JOIN activos a ON a.id_activo = h.id_activo
             WHERE h.id_hallazgo = $1`, [datos.id_hallazgo]);
        if (info.rows.length === 0) return null;
        id_activo = id_activo || info.rows[0].id_activo;
        cve_id = cve_id || info.rows[0].cve_id;
        codigo_activo = codigo_activo || info.rows[0].codigo_activo;
    }

    const severidad = datos.severidad;
    const prioridad = PRIORIDADES.includes(severidad) ? severidad : 'MEDIA';
    const sla = SLA_DIAS_POR_SEVERIDAD[severidad] || 30;
    const nombre = `Remediacion ${cve_id} - ${codigo_activo}`;

    // INSERT del plan: id_remediador NULL (manual), fecha_limite = hoy + SLA de la severidad.
    const r = await exec(
        `INSERT INTO planes_remediacion
            (id_empresa, nombre, descripcion, plan_accion, id_remediador, prioridad,
             fecha_inicio, fecha_limite, estado_plan, id_activo, creado_por)
         VALUES ($1,$2,$3,$4,NULL,$5,CURRENT_DATE,CURRENT_DATE + ($6 || ' days')::interval,'PENDIENTE',$7,$8)
         RETURNING *`,
        [id_empresa, nombre, nombre, nombre, prioridad, String(sla), id_activo, id_usuario]);
    const plan = r.rows[0];

    // Vincular el hallazgo al plan (relacion M:N).
    await exec(
        'INSERT INTO plan_vulnerabilidades (id_empresa, id_plan, id_hallazgo) VALUES ($1,$2,$3)',
        [id_empresa, plan.id_plan, datos.id_hallazgo]);

    // Transicionar la vuln DETECTADA/EN_ANALISIS -> PLANIFICADA.
    // require perezoso de vulnerabilidadService para evitar la dependencia circular.
    const estadoActual = await exec(
        'SELECT estado_hallazgo FROM hallazgos_vuln WHERE id_hallazgo = $1', [datos.id_hallazgo]);
    if (estadoActual.rows.length > 0 && ['DETECTADA', 'EN_ANALISIS'].includes(estadoActual.rows[0].estado_hallazgo)) {
        const { cambiarEstadoVulnerabilidad } = require('./vulnerabilidadService');
        await cambiarEstadoVulnerabilidad(id_empresa, id_usuario, datos.id_hallazgo, 'PLANIFICADA',
            `Incluida automaticamente en plan "${plan.nombre}"`, '127.0.0.1', { exec });
    }

    return plan;
};

module.exports = { crearPlanAutomatico };
