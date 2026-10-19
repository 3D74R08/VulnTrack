-- Seed idempotente de roles de empresa (ADMINISTRADOR / AUDITOR / REMEDIADOR).
-- Se separa del 04 del companero para NO pisar el 04 del usuario (aceptaciones_riesgo).
-- La tabla roles_empresa y su indice unico los crea init.sql; aqui solo se siembran filas.
-- Idempotente: ON CONFLICT DO NOTHING permite re-aplicar sobre volumenes existentes sin error.

BEGIN;

INSERT INTO roles_empresa (id_empresa, nombre, descripcion, permisos)
SELECT id_empresa, 'ADMINISTRADOR', 'Acceso total al sistema', '["ALL"]'::jsonb
FROM empresas
ON CONFLICT (id_empresa, nombre) DO NOTHING;

INSERT INTO roles_empresa (id_empresa, nombre, descripcion, permisos)
SELECT id_empresa, 'AUDITOR', 'Consulta y registro de vulnerabilidades',
       '["VER_ACTIVOS", "VER_VULN", "CREAR_VULN", "VER_RIESGOS"]'::jsonb
FROM empresas
ON CONFLICT (id_empresa, nombre) DO NOTHING;

INSERT INTO roles_empresa (id_empresa, nombre, descripcion, permisos)
SELECT id_empresa, 'REMEDIADOR', 'Gestion de planes de remediacion',
       '["VER_ACTIVOS", "VER_VULN", "GESTIONAR_REMEDIACION"]'::jsonb
FROM empresas
ON CONFLICT (id_empresa, nombre) DO NOTHING;

COMMIT;
