
const { queryConRLS } = require('../config/db');
const { registrarAuditoria } = require('../utils/auditoriaHelper');

const crearHallazgo = async (req, res) => {
    let { titulo, descripcion, cve_id, severidad, cvss, id_activo } = req.body;
    const { id_empresa, id_usuario } = req.usuario;
    
    if (!cve_id || !cve_id.trim()) {
        return res.status(400).json({ error: "El CVE ID del NVD es obligatorio." });
    }
    
    // Mapear severidad de ingles (NVD) a español (DB CHECK CONSTRAINT)
    const severityMap = {
        'CRITICAL': 'CRITICA',
        'HIGH': 'ALTA',
        'MEDIUM': 'MEDIA',
        'LOW': 'BAJA'
    };
    if (severityMap[severidad]) {
        severidad = severityMap[severidad];
    }
    
    try {
        const result = await queryConRLS(id_empresa, 
            `INSERT INTO hallazgos_vuln (id_empresa, titulo, descripcion, cve_id, severidad, cvss, estado_hallazgo, id_auditor) 
             VALUES ($1, $2, $3, $4, $5, $6, 'ABIERTO', $7) RETURNING *`,
            [id_empresa, titulo, descripcion, cve_id, severidad, cvss, id_usuario]
        );
        
        const hallazgo = result.rows[0];

        // Insertar relacion con activo si se envio id_activo
        if (id_activo) {
            await queryConRLS(id_empresa,
                `INSERT INTO hallazgos_activos (id_hallazgo, id_activo, id_empresa) VALUES ($1, $2, $3)`,
                [hallazgo.id_hallazgo, id_activo, id_empresa]
            );
        }

        await registrarAuditoria(id_empresa, id_usuario, 'Registró vulnerabilidad', 'Vulnerabilidades', { id_hallazgo: hallazgo.id_hallazgo, cve_id: hallazgo.cve_id }, req.ip);
        res.status(201).json(hallazgo);
    } catch (error) {
        console.error("Error crearHallazgo:", error);
        res.status(500).json({ error: "Error al crear hallazgo." });
    }
};

const obtenerHallazgos = async (req, res) => {
    const { id_empresa } = req.usuario;
    try {
        const result = await queryConRLS(id_empresa, 'SELECT * FROM hallazgos_vuln WHERE estado = TRUE ORDER BY fecha_descubrimiento DESC');
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener hallazgos." });
    }
};

const eliminarHallazgo = async (req, res) => {
    const { id } = req.params;
    const { id_empresa } = req.usuario;
    try {
        await queryConRLS(id_empresa, 'UPDATE hallazgos_vuln SET estado = FALSE WHERE id_hallazgo = $1', [id]);
        res.status(200).json({ mensaje: "Hallazgo eliminado lógicamente." });
    } catch (error) {
        res.status(500).json({ error: "Error al eliminar hallazgo." });
    }
};

const consultarNVD = async (req, res) => {
    const { cve } = req.params;
    
    // Validar formato básico de CVE (ej. CVE-2021-44228)
    if (!/^CVE-\d{4}-\d{4,}$/i.test(cve)) {
        return res.status(400).json({ error: "Formato de CVE inválido. Use el formato CVE-YYYY-NNNNN." });
    }

    try {
        // Hacemos la peticion a la API oficial del NIST
        // Nota: La API 2.0 del NVD permite 5 requests / 30 segs sin API Key.
        const response = await fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cve.toUpperCase()}`);
        
        if (!response.ok) {
            return res.status(response.status).json({ error: "Error al comunicarse con la base de datos del NVD." });
        }

        const data = await response.json();

        // Validar si la vulnerabilidad existe
        if (data.totalResults === 0 || !data.vulnerabilities || data.vulnerabilities.length === 0) {
            return res.status(404).json({ error: "Vulnerabilidad no encontrada en la base de datos del NIST." });
        }

        // Extraer y limpiar los datos que nos interesan
        const cveData = data.vulnerabilities[0].cve;
        
        // Buscar la descripción en inglés
        const descripcion = cveData.descriptions?.find(d => d.lang === 'en')?.value || "Sin descripción disponible.";
        
        // Extraer métricas CVSS V3.1 o V3.0
        const metricas = cveData.metrics?.cvssMetricV31?.[0]?.cvssData || cveData.metrics?.cvssMetricV30?.[0]?.cvssData || {};
        
        const severidad = metricas.baseSeverity || "DESCONOCIDA";
        const cvss_score = metricas.baseScore || null;

        res.status(200).json({
            cve_id: cveData.id,
            descripcion: descripcion,
            severidad: severidad,
            cvss: cvss_score,
            referencias: cveData.references?.map(r => r.url) || []
        });

    } catch (error) {
        console.error("[ERROR NVD]:", error.message);
        res.status(500).json({ error: "Error interno al consultar la NVD API." });
    }
};

module.exports = { crearHallazgo, obtenerHallazgos, eliminarHallazgo, consultarNVD };
