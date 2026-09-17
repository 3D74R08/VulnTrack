import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Edit2, 
  MoreVertical, 
  X,
  CheckCircle2,
  ShieldAlert,
  Activity,
  Briefcase,
  AlertCircle,
  Eye
} from 'lucide-react';

const predefinedRoles = [
  {
    id: 1,
    name: 'Administrador',
    description: 'Acceso total a todos los módulos y configuraciones.',
    icon: ShieldAlert,
    iconColor: 'text-purple-500',
    bgColor: 'bg-purple-100',
    gradient: 'from-purple-500 to-purple-700',
    summary: 'Full access'
  },
  {
    id: 2,
    name: 'Analista de Seguridad',
    description: 'Puede ver, analizar y gestionar vulnerabilidades y riesgos.',
    icon: Activity,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-100',
    gradient: 'from-blue-500 to-blue-700',
    summary: 'Módulos principales'
  },
  {
    id: 3,
    name: 'Gestor de Activos',
    description: 'Gestiona activos y su criticidad.',
    icon: Briefcase,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-100',
    gradient: 'from-green-500 to-green-700',
    summary: 'Activos + Vulnerabilidades'
  },
  {
    id: 4,
    name: 'Remediador',
    description: 'Gestiona planes de acción y seguimiento.',
    icon: AlertCircle,
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-100',
    gradient: 'from-orange-500 to-orange-700',
    summary: 'Remediación + Evidencias'
  },
  {
    id: 5,
    name: 'Auditor',
    description: 'Solo lectura. Acceso a auditoría y reportes.',
    icon: Eye,
    iconColor: 'text-gray-500',
    bgColor: 'bg-gray-100',
    gradient: 'from-gray-500 to-gray-700',
    summary: 'Reportes + Auditoría'
  }
];

export default function RolesPermisosView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('vulntrack_token');
        const response = await fetch('http://localhost:3000/api/usuarios', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setUsers(data);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const getUserCount = (roleId) => {
    return users.filter(u => u.id_rol === roleId).length;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Roles y Permisos</h1>
          </div>
          <p className="mt-2 text-gray-500">
            Gestiona los roles de los usuarios y sus permisos en la plataforma.
          </p>
        </div>
        <button 
          disabled
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 opacity-50 cursor-not-allowed font-medium"
        >
          + Crear rol
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
                <th className="px-6 py-4 font-medium">Rol</th>
                <th className="px-6 py-4 font-medium">Descripción</th>
                <th className="px-6 py-4 font-medium text-center">Usuarios</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {predefinedRoles.map((role) => {
                const Icon = role.icon;
                return (
                  <tr key={role.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${role.bgColor}`}>
                          <Icon className={`w-5 h-5 ${role.iconColor}`} />
                        </div>
                        <span className="font-medium text-gray-900">{role.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {role.description}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {loading ? '...' : getUserCount(role.id)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => setSelectedRole(role)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-5 gap-4">
        {predefinedRoles.map((role) => (
          <div key={role.id} className={`rounded-xl p-4 text-white bg-gradient-to-br ${role.gradient} shadow-sm`}>
            <h3 className="font-semibold text-sm mb-1">{role.name}</h3>
            <p className="text-xs text-white/80 line-clamp-2 mb-3 h-8">
              {role.description}
            </p>
            <div className="pt-3 border-t border-white/20">
              <span className="text-xs font-medium">{role.summary}</span>
            </div>
          </div>
        ))}
      </div>

      {selectedRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${selectedRole.bgColor}`}>
                  <selectedRole.icon className={`w-5 h-5 ${selectedRole.iconColor}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Detalles del Rol</h2>
                  <p className="text-sm text-gray-500">{selectedRole.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedRole(null)}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-gray-600 mb-6">{selectedRole.description}</p>
              
              <h3 className="font-semibold text-gray-900 mb-4">Permisos del Sistema</h3>
              
              <div className="space-y-4">
                {[
                  { name: 'Gestión de Usuarios', access: 'Solo lectura' },
                  { name: 'Gestión de Activos', access: 'Lectura / Gestión básica' },
                  { 
                    name: 'Gestión de Vulnerabilidades', 
                    access: 'Lectura / Gestión',
                    subItems: ['Ver vulnerabilidades', 'Crear / Editar vulnerabilidades', 'Asignar responsables']
                  },
                  { name: 'Evaluación y Gestión de Riesgos', access: 'Lectura / Gestión' },
                  { name: 'Remediación y Seguimiento', access: 'Lectura / Gestión' },
                  { name: 'Evidencias y Auditoría', access: 'Solo lectura' },
                  { name: 'Dashboard y Reportes', access: 'Lectura' }
                ].map((module, idx) => (
                  <div key={idx} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-start">
                      <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{module.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{module.access}</p>
                        
                        {module.subItems && (
                          <ul className="mt-2 space-y-1">
                            {module.subItems.map((sub, i) => (
                              <li key={i} className="text-xs text-gray-600 flex items-center">
                                <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                                {sub}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50 rounded-b-xl">
              <button 
                onClick={() => setSelectedRole(null)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={() => setSelectedRole(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
