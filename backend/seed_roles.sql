INSERT INTO roles_empresa (id_empresa, nombre, descripcion, permisos)
SELECT id_empresa, 'ADMINISTRADOR', 'Acceso total al sistema', '["VER_USUARIOS", "CREAR_USUARIOS", "EDITAR_ROLES", "VER_ACTIVOS", "CREAR_ACTIVOS", "VER_VULN", "CREAR_VULN", "VER_RIESGOS", "GESTIONAR_REMEDIACION"]'::jsonb
FROM empresas;

INSERT INTO roles_empresa (id_empresa, nombre, descripcion, permisos)
SELECT id_empresa, 'AUDITOR', 'Solo lectura y creacion', '["VER_ACTIVOS", "VER_VULN", "CREAR_VULN"]'::jsonb
FROM empresas;
