const { queryConRLS } = require('../config/db');
const { SLA_DIAS_POR_SEVERIDAD } = require('./riesgoService');

const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];

// Estados en los que NO se debe crear un plan automatico (riesgo ya cerrado o descartado).
const ESTADOS_SIN_PLAN = ['ACEPTADA', 'FALSO_POSITIVO', 'CERRADA'];

/**
 * Construye el texto estructurado del plan de accion en espanol (funcion pura y testeable).
 *
 * Devuelve 5 secciones Markdown: OBJETIVO, DESCRIPCION DEL PROBLEMA,
 * TAREAS SUGERIDAS (checklist estandar), PLAZO (SLA) y REFERENCIAS.
 *
 * @param {{cve_id?: string, cvss?: number|null, severidad?: string, descripcion?: string,
 *          referencias?: any, codigo_activo?: string, activo_nombre?: string, direccion_ip?: string}} datos
 * @returns {string} plan de accion preformateado.
 */
const construirPlanAccion = (datos = {}) => {
    const cve = datos.cve_id || 'CVE no asignado';
    const severidad = datos.severidad || 'MEDIA';
    const cvss = (datos.cvss === null || datos.cvss === undefined) ? 'N/D' : datos.cvss;
    const codigoActivo = datos.codigo_activo || 'activo desconocido';
    const nombreActivo = datos.activo_nombre || codigoActivo;

    // Fragmento de IP: se omite si no hay direccion_ip.
    const fragmentoIp = datos.direccion_ip ? ` (IP ${datos.direccion_ip})` : '';

    // SLA segun severidad + fecha limite calculada.
    const sla = SLA_DIAS_POR_SEVERIDAD[severidad] || 30;
    const fechaLimite = new Date(Date.now() + sla * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

    // Descripcion del problema: la del hallazgo o un marcador si falta.
    const descripcion = (datos.descripcion && String(datos.descripcion).trim())
        ? String(datos.descripcion).trim()
        : 'Pendiente de enriquecimiento NVD';

    // Normalizar referencias JSONB: pueden ser objetos ({url}) o strings; filtrar vacios.
    let referencias = [];
    try {
        const crudas = Array.isArray(datos.referencias) ? datos.referencias : [];
        referencias = crudas
            .map((ref) => {
                if (ref && typeof ref === 'object') return ref.url;
                if (typeof ref === 'string') return ref;
                return null;
            })
            .filter((url) => url && String(url).trim());
    } catch {
        referencias = [];
    }
    const bloqueReferencias = referencias.length > 0
        ? referencias.map((url) => `- ${url}`).join('\n')
        : 'Sin referencias NVD disponibles.';

    return `## OBJETIVO
Remediar la vulnerabilidad ${cve} (severidad ${severidad}, CVSS ${cvss}) en el activo ${nombreActivo} [${codigoActivo}]${fragmentoIp} dentro del plazo establecido por el SLA.

## DESCRIPCION DEL PROBLEMA
${descripcion}

## TAREAS SUGERIDAS
- [ ] Confirmar el alcance y validar que la vulnerabilidad aplica al activo ${codigoActivo}.
- [ ] Respaldar el sistema o la configuracion afectada antes de intervenir.
- [ ] Obtener el parche o la mitigacion oficial recomendada por el proveedor.
- [ ] Aplicar la correccion en un entorno de pruebas y verificar que no rompe el servicio.
- [ ] Desplegar la correccion en produccion dentro de una ventana de mantenimiento.
- [ ] Revalidar con un reescaneo y adjuntar la evidencia de cierre.

## PLAZO (SLA)
SLA para severidad ${severidad}: ${sla} dias. Fecha limite estimada: ${fechaLimite}.

## REFERENCIAS
${bloqueReferencias}`;
};

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

    // UNICO SELECT incondicional del hallazgo con JOIN a activos (sustituye las dos lecturas previas).
    const info = await exec(
        `SELECT h.id_activo, h.cve_id, h.cvss, h.severidad, h.descripcion, h.referencias,
                h.estado_hallazgo, a.codigo_activo, a.nombre AS activo_nombre, a.direccion_ip
         FROM hallazgos_vuln h JOIN activos a ON a.id_activo = h.id_activo
         WHERE h.id_hallazgo = $1`, [datos.id_hallazgo]);
    if (info.rows.length === 0) return null;
    const fila = info.rows[0];

    // Guarda C.3: no crear plan si la vuln ya esta ACEPTADA/FALSO_POSITIVO/CERRADA.
    if (ESTADOS_SIN_PLAN.includes(fila.estado_hallazgo)) return null;

    // Prioridad al dato del llamador; si no, el de la fila leida.
    const id_activo = datos.id_activo ?? fila.id_activo;
    const cve_id = datos.cve_id ?? fila.cve_id;
    const codigo_activo = datos.codigo_activo ?? fila.codigo_activo;

    const severidad = datos.severidad ?? fila.severidad;
    const prioridad = PRIORIDADES.includes(severidad) ? severidad : 'MEDIA';
    const sla = SLA_DIAS_POR_SEVERIDAD[severidad] || 30;

    // Los tres campos ahora son distintos: nombre corto, descripcion resumen y plan_accion estructurado.
    const nombre = `Remediacion ${cve_id} - ${codigo_activo}`;
    const descripcion = `Plan automatico para remediar ${cve_id} (severidad ${severidad}) en el activo ${codigo_activo}.`;
    const plan_accion = construirPlanAccion({
        cve_id,
        cvss: fila.cvss,
        severidad,
        descripcion: fila.descripcion,
        referencias: fila.referencias,
        codigo_activo,
        activo_nombre: fila.activo_nombre,
        direccion_ip: fila.direccion_ip,
    });

    // INSERT del plan: id_remediador NULL (manual), fecha_limite = hoy + SLA de la severidad.
    const r = await exec(
        `INSERT INTO planes_remediacion
            (id_empresa, nombre, descripcion, plan_accion, id_remediador, prioridad,
             fecha_inicio, fecha_limite, estado_plan, id_activo, creado_por)
         VALUES ($1,$2,$3,$4,NULL,$5,CURRENT_DATE,CURRENT_DATE + ($6 || ' days')::interval,'PENDIENTE',$7,$8)
         RETURNING *`,
        [id_empresa, nombre, descripcion, plan_accion, prioridad, String(sla), id_activo, id_usuario]);
    const plan = r.rows[0];

    // Vincular el hallazgo al plan (relacion M:N).
    await exec(
        'INSERT INTO plan_vulnerabilidades (id_empresa, id_plan, id_hallazgo) VALUES ($1,$2,$3)',
        [id_empresa, plan.id_plan, datos.id_hallazgo]);

    // Transicionar la vuln DETECTADA/EN_ANALISIS -> PLANIFICADA usando el estado ya leido (sin SELECT extra).
    // require perezoso de vulnerabilidadService para evitar la dependencia circular.
    if (['DETECTADA', 'EN_ANALISIS'].includes(fila.estado_hallazgo)) {
        const { cambiarEstadoVulnerabilidad } = require('./vulnerabilidadService');
        await cambiarEstadoVulnerabilidad(id_empresa, id_usuario, datos.id_hallazgo, 'PLANIFICADA',
            `Incluida automaticamente en plan "${plan.nombre}"`, '127.0.0.1', { exec });
    }

    return plan;
};

module.exports = { crearPlanAutomatico, construirPlanAccion };
