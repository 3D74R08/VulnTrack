-- =====================================================================
-- VulnTrack - Migración v5 (Limpieza de planes de remediación duplicados)
-- =====================================================================
-- Patrón idempotente de 03/04: BEGIN/COMMIT. Antes del blindaje con
-- pg_advisory_xact_lock en crearPlanAutomatico, una carrera entre el backfill
-- y el disparo del worker creó varios hallazgos con MÁS DE UN plan abierto.
--
-- Esta migración, para cada id_hallazgo con >1 plan ABIERTO
-- (p.estado=TRUE, pv.estado=TRUE, p.estado_plan NOT IN ('COMPLETADO','CANCELADO')),
-- conserva UN plan y CANCELA los sobrantes:
--   - Criterio de conservación (rn=1): preferir el que tenga id_remediador NOT NULL;
--     a igualdad, el de fecha_creacion más antigua; desempate final por id_plan.
--   - Sobrantes: estado_plan='CANCELADO', fecha_cierre=NOW() y pv.estado=FALSE de sus puentes.
--
-- IDEMPOTENTE: tras la primera corrida ya no quedan hallazgos con >1 plan abierto,
-- así que una segunda ejecución no selecciona ninguna fila y no cancela nada más.
BEGIN;

-- Puentes (plan_vulnerabilidades) de planes que deben CANCELARSE: todos los planes
-- abiertos de un hallazgo con duplicados EXCEPTO el conservado (rn=1).
WITH clasificados AS (
    SELECT pv.id_plan,
           pv.id_hallazgo,
           ROW_NUMBER() OVER (
               PARTITION BY pv.id_hallazgo
               ORDER BY (p.id_remediador IS NOT NULL) DESC,
                        p.fecha_creacion ASC,
                        p.id_plan ASC
           ) AS rn
    FROM plan_vulnerabilidades pv
    JOIN planes_remediacion p ON p.id_plan = pv.id_plan
    WHERE pv.estado = TRUE
      AND p.estado = TRUE
      AND p.estado_plan NOT IN ('COMPLETADO', 'CANCELADO')
),
duplicados AS (
    -- Solo hallazgos con más de un plan abierto; se descartan los que ya tienen uno solo.
    SELECT id_hallazgo
    FROM clasificados
    GROUP BY id_hallazgo
    HAVING COUNT(*) > 1
),
sobrantes AS (
    -- Planes a cancelar: los que NO son el conservado (rn > 1) de hallazgos con duplicados.
    SELECT c.id_plan, c.id_hallazgo
    FROM clasificados c
    JOIN duplicados d ON d.id_hallazgo = c.id_hallazgo
    WHERE c.rn > 1
),
planes_cancelados AS (
    -- Cancelar los planes sobrantes.
    UPDATE planes_remediacion p
    SET estado_plan = 'CANCELADO',
        fecha_cierre = NOW()
    FROM sobrantes s
    WHERE p.id_plan = s.id_plan
    RETURNING p.id_plan
)
-- Desactivar los puentes M:N de los planes recién cancelados.
UPDATE plan_vulnerabilidades pv
SET estado = FALSE
FROM planes_cancelados pc
WHERE pv.id_plan = pc.id_plan
  AND pv.estado = TRUE;

COMMIT;
