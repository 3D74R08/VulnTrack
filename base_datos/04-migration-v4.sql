-- =====================================================================
-- VulnTrack - Migración v4 (Aceptación de riesgo con firma y acta)
-- =====================================================================
-- Patrón idempotente de 03-migration-v3.sql: BEGIN/COMMIT, IF NOT EXISTS,
-- DROP POLICY IF EXISTS + CREATE POLICY, GRANT a app_user. RLS por id_empresa
-- con la variable de sesión app.current_tenant (BYPASS para workers internos).
BEGIN;

-- ---------- ACEPTACIÓN DE RIESGO (Bloque C) ----------
-- Registra el acto administrativo de aceptar un riesgo (vuln que no se remedia).
-- Una sola aceptación vigente por hallazgo (estado = TRUE); la previa se archiva.
CREATE TABLE IF NOT EXISTS aceptaciones_riesgo (
    id_aceptacion    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empresa       UUID NOT NULL REFERENCES empresas(id_empresa),
    id_hallazgo      UUID NOT NULL REFERENCES hallazgos_vuln(id_hallazgo),
    justificacion    TEXT NOT NULL,
    aceptado_por     UUID REFERENCES usuarios(id_usuario),
    fecha_aceptacion TIMESTAMP NOT NULL DEFAULT NOW(),
    -- NOT NULL; el controlador SIEMPRE la computa (hoy+90 por defecto). El DEFAULT de BD
    -- es defensa en profundidad: evita que un INSERT futuro que omita la columna falle.
    fecha_revision   DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '90 days'),
    firma_ruta       VARCHAR(255),      -- ruta relativa del PNG de la firma en UPLOAD_DIR
    documento_ruta   VARCHAR(255),      -- reservado (el acta se genera en cliente; ver C.4)
    estado           BOOLEAN DEFAULT TRUE,  -- aceptación vigente
    fecha_creacion   TIMESTAMP DEFAULT NOW()
);

ALTER TABLE aceptaciones_riesgo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aislar_aceptaciones_riesgo ON aceptaciones_riesgo;
-- Se endurece con WITH CHECK además de USING: esta tabla guarda un acto firmado,
-- así que se aísla también en INSERT/UPDATE (no solo en lectura). El predicado es
-- idéntico al USING, por lo que no cambia el comportamiento, solo cierra el hueco
-- de escribir una fila con id_empresa de otro tenant.
CREATE POLICY aislar_aceptaciones_riesgo ON aceptaciones_riesgo
  USING (
    current_setting('app.current_tenant', true) = 'BYPASS'
    OR id_empresa::text = current_setting('app.current_tenant', true))
  WITH CHECK (
    current_setting('app.current_tenant', true) = 'BYPASS'
    OR id_empresa::text = current_setting('app.current_tenant', true));

-- Índice parcial: acelera la búsqueda de la aceptación vigente por hallazgo.
CREATE INDEX IF NOT EXISTS idx_aceptaciones_hallazgo
  ON aceptaciones_riesgo (id_hallazgo) WHERE estado = TRUE;

GRANT SELECT, INSERT, UPDATE ON aceptaciones_riesgo TO app_user;

COMMIT;
