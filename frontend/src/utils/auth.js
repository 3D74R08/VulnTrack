export const getUserData = () => {
  const token = localStorage.getItem('vulntrack_token');
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

export const getUserRole = () => {
  const data = getUserData();
  return data ? data.rol : null;
};

// Control de interfaz por permisos; el backend vuelve a validar cada solicitud.
//
// Solo controla la UX (mostrar/ocultar controles). La seguridad real la
// impone SIEMPRE el backend; aqui usamos los MISMOS strings que el backend
// pasa a autorizarRoles. Mapeo accion -> permiso requerido:
export const tienePermiso = (...requeridos) => {
  const data = getUserData();
  if (!data) return false;
  const { rol, permisos } = data;
  if (rol === 'ADMINISTRADOR' || (Array.isArray(permisos) && permisos.includes('ALL'))) {
    return true;
  }
  const disponibles = new Set(Array.isArray(permisos) ? permisos : []);
  if (disponibles.has('CREAR_USUARIOS')) disponibles.add('VER_USUARIOS');
  if (disponibles.has('CREAR_ACTIVOS')) disponibles.add('VER_ACTIVOS');
  if (disponibles.has('CREAR_VULN')) {
    disponibles.add('VER_VULN');
    disponibles.add('VER_ACTIVOS');
  }
  if (disponibles.has('GESTIONAR_RIESGOS')) {
    disponibles.add('VER_RIESGOS');
    disponibles.add('VER_VULN');
  }
  if (disponibles.has('GESTIONAR_REMEDIACION')) {
    disponibles.add('VER_REMEDIACION');
    disponibles.add('VER_VULN');
  }
  return requeridos.some(p => disponibles.has(p));
};
