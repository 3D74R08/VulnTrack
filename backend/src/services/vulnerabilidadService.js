const { queryConRLS } = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoriaHelper');
const { crearNotificacion } = require('../utils/notificacionHelper');
const { consultarCve, esCveValido, normalizarCve } = require('./nvdService');

const ESTADOS_VULN = ['DETECTADA', 'EN_ANALISIS', 'PLANIFICADA', 'EN_REMEDIACION', 'MITIGADA', 'CORREGIDA', 'ACEPTADA', 'FALSO_POSITIVO', 'CERRADA'];
const ESTADOS_ABIERTOS = ['DETECTADA', 'EN_ANALISIS', 'PLANIFICADA', 'EN_REMEDIACION'];
const SOURCE_TYPES = ['MANUAL', 'EXCEL', 'NESSUS', 'OPENVAS', 'WAZUH', 'QUALYS', 'RAPID7', 'API'];

class ErrorNegocio extends Error {
    constructor(mensaje, codigo = 400) { super(mensaje); this.codigo = codigo; }
}

/**
 * Crea una vulnerabilidad aplicando todas las reglas de negocio.
 * Reutilizado por el registro manual y por la importación masiva.
 * @param {object} opciones - { nvdCache: Map, ip, notificar }
 * @returns {object} vulnerabilidad creada
 */
const crearVulnerabilidad = async (id_empresa, id_usuario, datos, opciones = {}) => {
    // nvdLookup permite a la importación masiva usar caché + presupuesto de consultas
    const { nvdLookup = consultarCve, ip = '127.0.0.1', notificar = true } = opciones;
    const cve_id = normalizarCve(datos.cve_id);

    // Regla: CVE obligatorio y con formato válido
    if (!cve_id) throw new ErrorNegocio('El CVE es obligatorio.');
    if (!esCveValido(cve_id)) throw new ErrorNegocio(`CVE inválido: "${datos.cve_id}". Formato esperado CVE-AAAA-NNNN.`);

    // Regla 2: debe estar asociada a un activo existente del mismo tenant (RLS lo garantiza)
    if (!datos.id_activo) throw new ErrorNegocio('La vulnerabilidad debe estar asociada a un activo.');
    const activo = await queryConRLS(id_empresa,
        'SELECT id_activo, codigo_activo, nombre, criticidad FROM activos WHERE id_activo = $1 AND estado = TRUE', [datos.id_activo]);
    if (activo.rows.length === 0) throw new ErrorNegocio('El activo indicado no existe.', 404);

    // Regla 4: no duplicar activo + CVE
    const dup = await queryConRLS(id_empresa,
        'SELECT id_hallazgo FROM hallazgos_vuln WHERE id_activo = $1 AND cve_id = $2', [datos.id_activo, cve_id]);
    if (dup.rows.length > 0) {
        const e = new ErrorNegocio(`El activo ${activo.rows[0].codigo_activo} ya tiene registrada la vulnerabilidad ${cve_id}.`, 409);
        e.duplicado = true;
        throw e;
    }

    const estado = datos.estado ? String(datos.estado).toUpperCase().replace(/\s+/g, '_') : 'DETECTADA';
    if (!ESTADOS_VULN.includes(estado)) throw new ErrorNegocio(`Estado no permitido: "${datos.estado}".`);

    const source_type = SOURCE_TYPES.includes(String(datos.source_type || '').toUpperCase())
        ? String(datos.source_type).toUpperCase() : 'MANUAL';

    // Enriquecimiento NVD (Sección 24). Si falla, se registra igual como PENDIENTE (Sección 26).
    const nvd = await nvdLookup(cve_id);

    const result = await queryConRLS(id_empresa,
        `INSERT INTO hallazgos_vuln (
            id_empresa, id_activo, cve_id, titulo, descripcion, severidad, cvss, estado_hallazgo, id_auditor,
            fecha_identificacion, fuente, source_type, external_id, observaciones,
            estado_enriquecimiento, fecha_publicacion_nvd, referencias, intentos_nvd
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,1)
         RETURNING *`,
        [
            id_empresa, datos.id_activo, cve_id, cve_id,
            nvd.ok ? nvd.descripcion : null,
            nvd.ok ? nvd.severidad : null,
            nvd.ok ? nvd.cvss : null,
            estado, id_usuario,
            datos.fecha_identificacion || new Date().toISOString().slice(0, 10),
            datos.fuente || (source_type === 'EXCEL' ? 'Carga masiva' : 'Manual'),
            source_type, datos.external_id || null, datos.observaciones || null,
            nvd.ok ? 'COMPLETADO' : 'PENDIENTE',
            nvd.ok ? nvd.fecha_publicacion : null,
            JSON.stringify(nvd.ok ? nvd.referencias : [])
        ]
    );
    const vuln = result.rows[0];

    // -- EVALUACION DE RIESGOS AUTOMATICA --
    // Delegada en el helper centralizado riesgoService.evaluarRiesgoAutomatico, que ademas
    // archiva la evaluacion vigente y dispara el plan automatico para ALTA/CRITICA.
    // require perezoso para evitar la dependencia circular con remediacionService.
    const { evaluarRiesgoAutomatico } = require('./riesgoService');
    await evaluarRiesgoAutomatico(id_empresa, id_usuario, vuln.id_hallazgo, {
        cvss: nvd.ok ? nvd.cvss : null,
        criticidad: activo.rows[0].criticidad,
        severidad: nvd.ok ? nvd.severidad : (vuln.severidad || undefined)
    });

    await queryConRLS(id_empresa,
        `INSERT INTO historial_vulnerabilidad (id_empresa, id_hallazgo, estado_anterior, estado_nuevo, comentario, id_usuario)
         VALUES ($1, $2, NULL, $3, $4, $5)`,
        [id_empresa, vuln.id_hallazgo, estado, `Registrada (${vuln.fuente})`, id_usuario]);

    await registrarAuditoria(id_empresa, id_usuario, 'VULNERABILITY_CREATED', 'Vulnerabilidades',
        { cve_id, codigo_activo: activo.rows[0].codigo_activo, fuente: vuln.fuente, nvd: nvd.ok ? 'OK' : nvd.motivo }, ip,
        { recurso: 'vulnerabilidad', id_recurso: vuln.id_hallazgo,
          descripcion: `${cve_id} registrada en ${activo.rows[0].codigo_activo}` });

    if (notificar) {
        await crearNotificacion(id_empresa, {
            tipo: vuln.severidad === 'CRITICA' ? 'VULN_CRITICA' : 'VULN_REGISTRADA',
            titulo: vuln.severidad === 'CRITICA' ? `Nueva vulnerabilidad crítica: ${cve_id}` : `Nueva vulnerabilidad: ${cve_id}`,
            mensaje: `Registrada en ${activo.rows[0].codigo_activo} - ${activo.rows[0].nombre}${vuln.cvss ? ` (CVSS ${vuln.cvss})` : ''}.`,
            recurso: 'vulnerabilidad', id_recurso: vuln.id_hallazgo
        });
    }
    return vuln;
};

/**
 * Cambia el estado dejando historial + auditoría (Sección 27).
 */
const cambiarEstadoVulnerabilidad = async (id_empresa, id_usuario, id_hallazgo, nuevoEstado, comentario, ip, opciones = {}) => {
    // Ejecutor inyectable: por defecto queryConRLS (RLS). El flujo automatico del worker
    // inyecta su client BYPASS para que la transicion viva en la MISMA transaccion que el plan.
    const exec = opciones.exec || ((sql, params) => queryConRLS(id_empresa, sql, params));
    const estado = String(nuevoEstado || '').toUpperCase();
    if (!ESTADOS_VULN.includes(estado)) throw new ErrorNegocio(`Estado no permitido: "${nuevoEstado}".`);

    const actual = await exec(
        'SELECT id_hallazgo, cve_id, estado_hallazgo FROM hallazgos_vuln WHERE id_hallazgo = $1 AND estado = TRUE', [id_hallazgo]);
    if (actual.rows.length === 0) throw new ErrorNegocio('Vulnerabilidad no encontrada.', 404);
    const anterior = actual.rows[0].estado_hallazgo;
    if (anterior === estado) return actual.rows[0];

    const upd = await exec(
        `UPDATE hallazgos_vuln SET estado_hallazgo = $1, fecha_actualizacion = NOW() WHERE id_hallazgo = $2 RETURNING *`,
        [estado, id_hallazgo]);
    await exec(
        `INSERT INTO historial_vulnerabilidad (id_empresa, id_hallazgo, estado_anterior, estado_nuevo, comentario, id_usuario)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id_empresa, id_hallazgo, anterior, estado, comentario || null, id_usuario]);
    await registrarAuditoria(id_empresa, id_usuario, 'VULNERABILITY_STATUS_CHANGED', 'Vulnerabilidades',
        { cve_id: actual.rows[0].cve_id, anterior, nuevo: estado }, ip,
        { recurso: 'vulnerabilidad', id_recurso: id_hallazgo, descripcion: `${anterior} → ${estado}` });

    await crearNotificacion(id_empresa, {
        tipo: estado === 'CORREGIDA' ? 'VULN_CORREGIDA' : 'VULN_ESTADO_ACTUALIZADO',
        titulo: estado === 'CORREGIDA'
            ? `Vulnerabilidad corregida: ${actual.rows[0].cve_id}`
            : `Estado actualizado: ${actual.rows[0].cve_id}`,
        mensaje: `${anterior} → ${estado}`,
        recurso: 'vulnerabilidad', id_recurso: id_hallazgo
    });
    return upd.rows[0];
};

module.exports = { crearVulnerabilidad, cambiarEstadoVulnerabilidad, ErrorNegocio, ESTADOS_VULN, ESTADOS_ABIERTOS };
