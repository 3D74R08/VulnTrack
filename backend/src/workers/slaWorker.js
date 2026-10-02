const cron = require('node-cron');
const { pool } = require('../config/db');

const startSLAWorker = () => {
    // Para propósitos de desarrollo y evaluación, el worker corre cada minuto ('* * * * *').
    // En producción corporativa, esto sería a media noche todos los días ('0 0 * * *').
    cron.schedule('* * * * *', async () => {
        console.log('🔄 [Background Worker] Ejecutando monitoreo de SLAs (Planes de Acción)...');
        const client = await pool.connect();
        try {
            // El Worker opera a nivel sistema global, debe pasar por el bypass para leer de todos los inquilinos (empresas)
            await client.query("SELECT set_config('app.current_tenant', 'BYPASS', true)");
            await client.query("BEGIN");
            
            // Buscar planes pendientes o en proceso cuya fecha haya expirado
            const selectQuery = `
                SELECT id_plan, id_empresa, id_hallazgo, fecha_limite
                FROM planes_remediacion
                WHERE estado_plan NOT IN ('COMPLETADO', 'VENCIDO')
                AND fecha_limite < CURRENT_DATE
                AND estado = TRUE
            `;
            
            const { rows: expiredPlans } = await client.query(selectQuery);
            
            if (expiredPlans.length > 0) {
                console.log(`⚠️  [SLA Alert] Se encontraron ${expiredPlans.length} planes vencidos. Procesando...`);
                
                for (let plan of expiredPlans) {
                    // 1. Actualizar el estado a VENCIDO
                    await client.query(
                        `UPDATE planes_remediacion SET estado_plan = 'VENCIDO' WHERE id_plan = $1`,
                        [plan.id_plan]
                    );

                    // 2. Registrar la trazabilidad en eventos_auditoria
                    // No pasamos id_usuario porque es una acción automática del SISTEMA
                    const detalles = {
                        mensaje: `El plan de acción ha superado la fecha límite estricta (${new Date(plan.fecha_limite).toLocaleDateString()}). El sistema lo marcó como VENCIDO.`,
                        id_hallazgo: plan.id_hallazgo,
                        sistema: true
                    };
                    
                    await client.query(
                        `INSERT INTO eventos_auditoria (id_empresa, accion, modulo, detalles)
                         VALUES ($1, $2, $3, $4)`,
                        [plan.id_empresa, 'SLA_VENCIDO', 'REMEDIACION_SISTEMA', detalles]
                    );
                }
                console.log('✅ [Background Worker] Modificaciones y trazabilidad insertadas con éxito.');
            } else {
                 console.log('✅ [Background Worker] Todos los SLAs están en orden. Ningún plan vencido.');
            }
            
            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            console.error('❌ [Background Worker] Error procesando SLAs:', error);
        } finally {
            client.release();
        }
    });
    
    console.log('🤖 Background Worker (SLA Monitor) inicializado exitosamente.');
};

module.exports = startSLAWorker;
