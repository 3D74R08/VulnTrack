import React, { useState, useEffect } from 'react';
import { Users, Edit, Trash2, X } from 'lucide-react';

export default function UsuariosView() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState('');

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('vulntrack_token');
      const res = await fetch('http://localhost:3000/api/usuarios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setUsuarios(await res.json());
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('vulntrack_token');
      const res = await fetch(`http://localhost:3000/api/usuarios/${editingUser.id_usuario}/rol`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rol: newRole })
      });
      
      if (res.ok) {
        setIsEditModalOpen(false);
        fetchUsuarios();
      }
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro que desea eliminar este usuario?')) return;
    
    try {
      const token = localStorage.getItem('vulntrack_token');
      const res = await fetch(`http://localhost:3000/api/usuarios/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        fetchUsuarios();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const getRoleBadgeColor = (rol) => {
    switch (rol) {
      case 'ADMINISTRADOR': return 'bg-purple-100 text-purple-800';
      case 'ANALISTA_SEGURIDAD': return 'bg-blue-100 text-blue-800';
      case 'GESTOR_ACTIVOS': return 'bg-green-100 text-green-800';
      case 'REMEDIADOR': return 'bg-orange-100 text-orange-800';
      case 'AUDITOR': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setNewRole(user.rol);
    setIsEditModalOpen(true);
  };

  const rolesList = ['ADMINISTRADOR', 'ANALISTA_SEGURIDAD', 'GESTOR_ACTIVOS', 'REMEDIADOR', 'AUDITOR'];

  return (
    <div className="p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Users className="w-8 h-8 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="text-center py-10">Cargando usuarios...</div>
        ) : usuarios.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No se encontraron usuarios.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm border-b">
                  <th className="px-6 py-4 font-medium">Nombre</th>
                  <th className="px-6 py-4 font-medium">Correo</th>
                  <th className="px-6 py-4 font-medium">Rol</th>
                  <th className="px-6 py-4 font-medium">Fecha de registro</th>
                  <th className="px-6 py-4 font-medium text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((user) => (
                  <tr key={user.id_usuario} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {user.nombre_completo}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.correo}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs rounded-full font-medium ${getRoleBadgeColor(user.rol)}`}>
                        {user.rol?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.fecha_creacion ? new Date(user.fecha_creacion).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-center space-x-2">
                      <button 
                        onClick={() => openEditModal(user)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar rol"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(user.id_usuario)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Editar Rol</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4 text-sm text-gray-600">
              Usuario: <span className="font-semibold">{editingUser.nombre_completo}</span>
            </div>
            <form onSubmit={handleEditRole} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo Rol</label>
                <select
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  {rolesList.map(r => (
                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="mr-3 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
