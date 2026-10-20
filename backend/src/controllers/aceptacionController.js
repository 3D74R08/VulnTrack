const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { queryConRLS, conTransaccionRLS } = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoriaHelper');
const { cambiarEstadoVulnerabilidad } = require('../services/vulnerabilidadService');

// Directorio de subidas (patrón de remediacionController): en el contenedor apunta
// a /app/uploads (volumen persistente), con fallback local si no hay UPLOAD_DIR.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

// Estados en los que la vulnerabilidad ya no admite una nueva aceptación de riesgo.
const ESTADOS_SIN_ACEPTACION = ['ACEPTADA', 'CERRADA', 'FALSO_POSITIVO'];

// Prefijo obligatorio del dataURL de la firma PNG.
const PREFIJO_PNG = 'data:image/png;base64,';
// Límites del PNG decodificado (FIX 5 del review de diseño): el mínimo descarta un
// canvas en blanco (PNG transparente de pocos cientos de bytes); el máximo evita abuso.
const FIRMA_MIN_BYTES = 1024;        // > 1 KB
const FIRMA_MAX_BYTES = 2 * 1024 * 1024; // < 2 MB

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolverRutaSegura = (directorioBase, rutaRelativa) => {
    const base = path.resolve(directorioBase);
    const destino = path.resolve(base, rutaRelativa);
    const relativa = path.relative(base, destino);

    if (
        !relativa ||
        relativa.startsWith(`..${path.sep}`) ||
        relativa === '..' ||
        path.isAbsolute(relativa)
    ) {
        throw new Error('Ruta de archivo no permitida.');
    }

    return destino;
};

/**
 * Aceptar el riesgo de una vulnerabilidad (solo ADMINISTRADOR).
 * Body: { id_hallazgo, justificacion, fecha_revision?, firma (dataURL PNG) }.
 */
const aceptarRiesgo = async (req, res) => {
    const { id_empresa, id_usuario } = req.usuario;
    const { id_hallazgo, justificacion, fecha_revision, firma } = req.body;

    // --- 1) Validaciones de entrada (todas 400 en español) ---
    if (!id_hallazgo || !RE_UUID.test(String(id_hallazgo))) {
        return res.status(400).json({ error: 'id_hallazgo es obligatorio y debe ser un UUID válido.' });
    }
    const justif = String(justificacion || '').trim();
    if (!justif) return res.status(400).json({ error: 'La justificación es obligatoria.' });
    if (justif.length > 4000) return res.status(400).json({ error: 'La justificación no puede superar los 4000 caracteres.' });

    if (typeof firma !== 'string' || !firma.startsWith(PREFIJO_PNG)) {
        return res.status(400).json({ error: 'La firma es obligatoria y debe ser una imagen PNG.' });
    }
    // FIX 4: decodificar el base64 SIN el prefijo dataURL y guardar el buffer binario.
    const base64SinPrefijo = firma.slice(PREFIJO_PNG.length);
    let bufferFirma;
    try {
        bufferFirma = Buffer.from(base64SinPrefijo, 'base64');
    } catch (e) {
        return res.status(400).json({ error: 'Firma inválida.' });
    }
    if (!bufferFirma || bufferFirma.length <= FIRMA_MIN_BYTES || bufferFirma.length >= FIRMA_MAX_BYTES) {
        return res.status(400).json({ error: 'Firma inválida.' });
    }

    // fecha_revision opcional: válida y estrictamente futura; por defecto hoy+90.
    let fechaRevisionFinal;
    if (fecha_revision !== undefined && fecha_revision !== null && String(fecha_revision).trim() !== '') {
        const fr = new Date(fecha_revision);
        if (isNaN(fr.getTime())) return res.status(400).json({ error: 'La fecha de revisión no es válida.' });
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        if (fr <= hoy) return res.status(400).json({ error: 'La fecha de revisión debe ser posterior a hoy.' });
        fechaRevisionFinal = fr.toISOString().slice(0, 10);
    } else {
        const porDefecto = new Date();
        porDefecto.setDate(porDefecto.getDate() + 90);
        fechaRevisionFinal = porDefecto.toISOString().slice(0, 10);
    }

    // rutaPngAbsoluta queda definida solo si el PNG llegó a escribirse (para cleanup en catch).
    let rutaPngAbsoluta = null;

    try {
        // --- 2) Verificar hallazgo vigente y que admita aceptación ---
        const h = await queryConRLS(id_empresa,
            `SELECT h.id_hallazgo, h.cve_id, h.severidad, h.cvss, h.descripcion, h.estado_hallazgo,
                    a.nombre AS activo_nombre, a.codigo_activo, a.direccion_ip,
                    r.puntaje AS riesgo_puntaje, r.clasificacion AS riesgo_clasificacion
             FROM hallazgos_vuln h
             JOIN activos a ON a.id_activo = h.id_activo
             LEFT JOIN riesgos r ON r.id_hallazgo = h.id_hallazgo AND r.estado = TRUE
             WHERE h.id_hallazgo = $1 AND h.estado = TRUE`, [id_hallazgo]);
        if (h.rows.length === 0) return res.status(404).json({ error: 'Vulnerabilidad no encontrada.' });
        const hallazgo = h.rows[0];
        if (ESTADOS_SIN_ACEPTACION.includes(hallazgo.estado_hallazgo)) {
            return res.status(409).json({ error: 'La vulnerabilidad ya no admite aceptación.' });
        }

        // --- 3) Guardar el PNG binario ANTES de la transacción (patrón agregarEvidencia) ---
        const dir = path.join(UPLOAD_DIR, id_empresa);
        fs.mkdirSync(dir, { recursive: true });
        const archivo = `${crypto.randomUUID()}.png`;
        rutaPngAbsoluta = path.join(dir, archivo);
        fs.writeFileSync(rutaPngAbsoluta, bufferFirma);
        const firmaRuta = path.join(id_empresa, archivo); // ruta relativa guardada en BD

        const comentario = `Riesgo aceptado: ${justif.slice(0, 200)}`;

        // --- FIX 1: envolver 4-8 en una única transacción RLS (atomicidad) ---
        const aceptacion = await conTransaccionRLS(id_empresa, async (exec) => {
            // (a) Archivar aceptación previa vigente si existiera.
            await exec(
                'UPDATE aceptaciones_riesgo SET estado = FALSE WHERE id_hallazgo = $1 AND estado = TRUE',
                [id_hallazgo]);

            // (b) Insertar la nueva aceptación (fecha_revision SIEMPRE explícita; sin documento_ruta).
            const ins = await exec(
                `INSERT INTO aceptaciones_riesgo
                    (id_empresa, id_hallazgo, justificacion, aceptado_por, fecha_aceptacion, fecha_revision, firma_ruta)
                 VALUES ($1, $2, $3, $4, NOW(), $5, $6) RETURNING *`,
                [id_empresa, id_hallazgo, justif, id_usuario, fechaRevisionFinal, firmaRuta]);

            // (c) Cancelar el/los plan(es) abiertos del hallazgo (pv.estado=TRUE obligatorio).
            await exec(
                `UPDATE planes_remediacion p SET estado_plan = 'CANCELADO', fecha_cierre = NOW()
                 FROM plan_vulnerabilidades pv
                 WHERE pv.id_plan = p.id_plan AND pv.id_hallazgo = $1 AND pv.estado = TRUE
                   AND p.estado = TRUE AND p.estado_plan NOT IN ('COMPLETADO','CANCELADO')`,
                [id_hallazgo]);

            // (d) Transicionar la vulnerabilidad a ACEPTADA dentro de la MISMA transacción.
            await cambiarEstadoVulnerabilidad(id_empresa, id_usuario, id_hallazgo, 'ACEPTADA', comentario, req.ip, { exec });

            return ins.rows[0];
        });

        // (e) Auditoría (best-effort, fuera de la transacción: no debe tumbar el flujo).
        await registrarAuditoria(id_empresa, id_usuario, 'RISK_ACCEPTED', 'Riesgos',
            { cve_id: hallazgo.cve_id, fecha_revision: fechaRevisionFinal }, req.ip,
            { recurso: 'vulnerabilidad', id_recurso: id_hallazgo, descripcion: comentario });

        // --- 9) Resolver el nombre de empresa (no está en el JWT) y responder 201 ---
        const emp = await queryConRLS(id_empresa, 'SELECT nombre_empresa FROM empresas WHERE id_empresa = $1', [id_empresa]);
        const nombreEmpresa = emp.rows.length > 0 ? emp.rows[0].nombre_empresa : null;

        return res.status(201).json({
            aceptacion,
            empresa: { nombre_empresa: nombreEmpresa },
            cve: {
                cve_id: hallazgo.cve_id,
                severidad: hallazgo.severidad,
                cvss: hallazgo.cvss,
                descripcion: hallazgo.descripcion
            },
            activo: {
                nombre: hallazgo.activo_nombre,
                codigo: hallazgo.codigo_activo,
                ip: hallazgo.direccion_ip
            },
            riesgo: {
                puntaje: hallazgo.riesgo_puntaje,
                clasificacion: hallazgo.riesgo_clasificacion
            },
            aceptante: {
                nombre_completo: req.usuario.nombre_completo,
                correo: req.usuario.correo
            },
            firma // eco del dataURL para estampar el acta sin segunda descarga
        });
    } catch (error) {
        // FIX 2: si el PNG se escribió y la operación falló, borrarlo best-effort.
        if (rutaPngAbsoluta) {
            fs.unlink(rutaPngAbsoluta, () => {});
        }
        console.error('[ERROR ACEPTAR RIESGO]:', error.message);
        // Errores de negocio (ErrorNegocio con .codigo) se respetan; el resto es 500.
        const codigo = error.codigo && error.codigo >= 400 && error.codigo < 500 ? error.codigo : 500;
        return res.status(codigo).json({ error: codigo === 500 ? 'Error al aceptar el riesgo.' : error.message });
    }
};

/**
 * Consultar la aceptación vigente de un hallazgo (autenticado). GET /:idHallazgo.
 */
const consultarAceptacion = async (req, res) => {
    const { id_empresa } = req.usuario;
    try {
        const r = await queryConRLS(id_empresa,
            `SELECT ar.*, e.nombre_empresa,
                    h.cve_id, h.severidad, h.cvss, h.descripcion,
                    a.nombre AS activo_nombre, a.codigo_activo, a.direccion_ip,
                    rg.puntaje AS riesgo_puntaje, rg.clasificacion AS riesgo_clasificacion,
                    u.nombre_completo AS aceptante_nombre, u.correo AS aceptante_correo
             FROM aceptaciones_riesgo ar
             JOIN empresas e ON e.id_empresa = ar.id_empresa
             JOIN hallazgos_vuln h ON h.id_hallazgo = ar.id_hallazgo
             JOIN activos a ON a.id_activo = h.id_activo
             LEFT JOIN riesgos rg ON rg.id_hallazgo = h.id_hallazgo AND rg.estado = TRUE
             LEFT JOIN usuarios u ON u.id_usuario = ar.aceptado_por
             WHERE ar.id_hallazgo = $1 AND ar.estado = TRUE
             ORDER BY ar.fecha_aceptacion DESC LIMIT 1`, [req.params.idHallazgo]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'No hay una aceptación vigente para esta vulnerabilidad.' });
        const fila = r.rows[0];
        return res.status(200).json({
            aceptacion: {
                id_aceptacion: fila.id_aceptacion,
                id_hallazgo: fila.id_hallazgo,
                justificacion: fila.justificacion,
                fecha_aceptacion: fila.fecha_aceptacion,
                fecha_revision: fila.fecha_revision,
                firma_ruta: fila.firma_ruta,
                estado: fila.estado
            },
            empresa: { nombre_empresa: fila.nombre_empresa },
            cve: {
                cve_id: fila.cve_id,
                severidad: fila.severidad,
                cvss: fila.cvss,
                descripcion: fila.descripcion
            },
            activo: {
                nombre: fila.activo_nombre,
                codigo: fila.codigo_activo,
                ip: fila.direccion_ip
            },
            riesgo: {
                puntaje: fila.riesgo_puntaje,
                clasificacion: fila.riesgo_clasificacion
            },
            aceptante: {
                nombre_completo: fila.aceptante_nombre,
                correo: fila.aceptante_correo
            }
        });
    } catch (error) {
        console.error('[ERROR CONSULTAR ACEPTACION]:', error.message);
        return res.status(500).json({ error: 'Error al consultar la aceptación de riesgo.' });
    }
};

/**
 * Descargar el PNG de la firma. GET /:idAceptacion/firma.
 * FIX 3: lee req.params.idAceptacion (PK de aceptaciones_riesgo, NO id_hallazgo).
 */
const descargarFirma = async (req, res) => {
    const { id_empresa } = req.usuario;

    try {
        const r = await queryConRLS(
            id_empresa,
            'SELECT firma_ruta FROM aceptaciones_riesgo WHERE id_aceptacion = $1',
            [req.params.idAceptacion]
        );

        if (r.rows.length === 0 || !r.rows[0].firma_ruta) {
            return res.status(404).json({ error: 'Firma no encontrada.' });
        }

        let abs;

        try {
            abs = resolverRutaSegura(UPLOAD_DIR, r.rows[0].firma_ruta);
        } catch {
            return res.status(404).json({ error: 'Firma no encontrada.' });
        }

        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
            return res.status(404).json({ error: 'Firma no encontrada.' });
        }

        return res.sendFile(abs);
    } catch (error) {
        console.error('[ERROR DESCARGAR FIRMA]:', error.message);
        return res.status(500).json({ error: 'Error al descargar la firma.' });
    }
};

module.exports = { aceptarRiesgo, consultarAceptacion, descargarFirma };
