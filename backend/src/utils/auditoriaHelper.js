const { queryConRLS } = require('../config/db');

const registrarAuditoria = async (id_empresa, id_usuario, accion, modulo, detalles = {}, ip_origen = '127.0.0.1') => {
    try {
        await queryConRLS(id_empresa,
            `INSERT INTO eventos_auditoria (id_empresa, id_usuario, accion, modulo, detalles, ip_origen)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id_empresa, id_usuario, accion, modulo, JSON.stringify(detalles), ip_origen]
        );
    } catch (error) {
        console.error("[ERROR AUDITORIA HELPER]:", error.message);
    }
};

module.exports = { registrarAuditoria };
