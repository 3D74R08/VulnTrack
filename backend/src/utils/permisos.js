const PERMISOS_VALIDOS = new Set([
    'VER_USUARIOS', 'CREAR_USUARIOS', 'VER_ACTIVOS', 'CREAR_ACTIVOS',
    'VER_VULN', 'CREAR_VULN', 'VER_RIESGOS', 'GESTIONAR_RIESGOS',
    'VER_REMEDIACION', 'GESTIONAR_REMEDIACION', 'VER_AUDITORIA',
    'VER_DASHBOARD', 'IMPORTAR_DATOS', 'EDITAR_ROLES'
]);

const expandirPermisos = (permisos = []) => {
    const resultado = new Set(Array.isArray(permisos) ? permisos : []);
    if (resultado.has('CREAR_USUARIOS')) resultado.add('VER_USUARIOS');
    if (resultado.has('CREAR_ACTIVOS')) resultado.add('VER_ACTIVOS');
    if (resultado.has('CREAR_VULN')) {
        resultado.add('VER_VULN');
        resultado.add('VER_ACTIVOS');
    }
    if (resultado.has('GESTIONAR_RIESGOS')) {
        resultado.add('VER_RIESGOS');
        resultado.add('VER_VULN');
    }
    if (resultado.has('GESTIONAR_REMEDIACION')) {
        resultado.add('VER_REMEDIACION');
        resultado.add('VER_VULN');
    }
    return [...resultado];
};

module.exports = { PERMISOS_VALIDOS, expandirPermisos };
