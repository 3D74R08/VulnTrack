import React, { useState, useEffect } from 'react';
import { Monitor, Search, Filter, Plus, X } from 'lucide-react';

export default function ActivosView() {
  const [activos, setActivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'Servidor',
    criticidad: 'MEDIA',
    propietario: ''
  });

  const tabs = ['Todos', 'Servidores', 'Equipos', 'Aplicaciones', 'APIs', 'Bases de datos'];

  useEffect(() => {
    fetchActivos();
  }, []);

  const fetchActivos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('vulntrack_token');
      const res = await fetch('http://localhost:3000/api/activos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setActivos(data);
      }
    } catch (error) {
      console.error('Error fetching activos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('vulntrack_token');
      const res = await fetch('http://localhost:3000/api/activos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ nombre: '', tipo: 'Servidor', criticidad: 'MEDIA', propietario: '' });
        fetchActivos();
      }
    } catch (error) {
      console.error('Error creating activo:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar activo?')) return;
    try {
      const token = localStorage.getItem('vulntrack_token');
      const res = await fetch(`http://localhost:3000/api/activos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchActivos();
      }
    } catch (error) {
      console.error('Error deleting activo:', error);
    }
  };

  const getCriticidadColor = (crit) => {
    switch (crit) {
      case 'CRITICA': return 'bg-red-100 text-red-800';
      case 'ALTA': return 'bg-orange-100 text-orange-800';
      case 'MEDIA': return 'bg-yellow-100 text-yellow-800';
      case 'BAJA': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredActivos = activos.filter(a => {
    const matchesTab = activeTab === 'Todos' || 
      (activeTab === 'Servidores' && a.tipo === 'Servidor') ||
      (activeTab === 'Equipos' && a.tipo === 'Equipo') ||
      (activeTab === 'Aplicaciones' && a.tipo === 'Aplicación') ||
      (activeTab === 'APIs' && a.tipo === 'API') ||
      (activeTab === 'Bases de datos' && a.tipo === 'Base de datos');
    
    const matchesSearch = a.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.propietario?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Monitor className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Activos</h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Registrar activo
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4 flex gap-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap pb-2 text-sm font-medium ${
                activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o propietario..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Nombre</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Criticidad</th>
                <th className="px-6 py-3">Propietario</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="6" className="text-center py-8">Cargando...</td></tr>
              ) : filteredActivos.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-8">No se encontraron activos.</td></tr>
              ) : (
                filteredActivos.map(activo => (
                  <tr key={activo.id_activo} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{activo.nombre}</td>
                    <td className="px-6 py-4 text-gray-500">{activo.tipo}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getCriticidadColor(activo.criticidad)}`}>
                        {activo.criticidad}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{activo.propietario}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Activo
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(activo.id_activo)} className="text-red-500 hover:text-red-700 text-xs font-medium">Eliminar</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
          <span>Mostrando {filteredActivos.length} resultados</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">Anterior</button>
            <button className="px-3 py-1 border border-gray-300 rounded bg-blue-50 text-blue-600 font-medium">1</button>
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">Siguiente</button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Registrar activo</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input required type="text" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                  <option value="Servidor">Servidor</option>
                  <option value="Equipo">Equipo</option>
                  <option value="Aplicación">Aplicación</option>
                  <option value="API">API</option>
                  <option value="Base de datos">Base de datos</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Criticidad</label>
                <select className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.criticidad} onChange={e => setFormData({...formData, criticidad: e.target.value})}>
                  <option value="CRITICA">Crítica</option>
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Media</option>
                  <option value="BAJA">Baja</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Propietario</label>
                <input required type="text" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.propietario} onChange={e => setFormData({...formData, propietario: e.target.value})} />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
