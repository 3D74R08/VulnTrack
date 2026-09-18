import React, { useState, useEffect } from 'react';
import { CheckCircle, Plus, Search, Filter, X } from 'lucide-react';
import { getUserRole } from '../utils/auth';

export default function RemediacionesView() {
  const [planes, setPlanes] = useState([]);
  const [hallazgos, setHallazgos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  
  const [formData, setFormData] = useState({
    id_hallazgo: '',
    id_remediador: '',
    plan_accion: '',
    fecha_limite: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('vulntrack_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [planesRes, hallazgosRes, usuariosRes] = await Promise.all([
        fetch('http://localhost:3000/api/remediacion', { headers }),
        fetch('http://localhost:3000/api/hallazgos', { headers }),
        fetch('http://localhost:3000/api/usuarios', { headers })
      ]);

      if (planesRes.ok) setPlanes(await planesRes.json());
      if (hallazgosRes.ok) setHallazgos(await hallazgosRes.json());
      if (usuariosRes.ok) setUsuarios(await usuariosRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('vulntrack_token');
      const res = await fetch('http://localhost:3000/api/remediacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
        setFormData({ id_hallazgo: '', id_remediador: '', plan_accion: '', fecha_limite: '' });
      }
    } catch (error) {
      console.error('Error creating plan:', error);
    }
  };

  const getSLAInfo = (fecha_limite) => {
    if (!fecha_limite) return { text: 'N/A', color: 'text-gray-500' };
    const limitDate = new Date(fecha_limite);
    const today = new Date();
    const diffTime = limitDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Vencido', color: 'text-red-600 font-semibold' };
    if (diffDays <= 3) return { text: `${diffDays} días`, color: 'text-orange-500 font-semibold' };
    return { text: `${diffDays} días`, color: 'text-green-600 font-semibold' };
  };

  const getStatusBadgeColor = (estado) => {
    switch (estado) {
      case 'COMPLETADO': return 'bg-green-100 text-green-800';
      case 'EN_PROCESO': return 'bg-blue-100 text-blue-800';
      case 'VENCIDO': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800'; // PENDIENTE
    }
  };

  const filteredPlanes = planes.filter(plan => {
    const matchStatus = statusFilter === 'TODOS' || plan.estado_plan === statusFilter;
    const matchSearch = plan.id_hallazgo?.toString().includes(searchTerm) || plan.plan_accion?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <CheckCircle className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-800">Remediación y Seguimiento</h1>
          </div>
          <p className="text-gray-500">Planes de acción</p>
        </div>
        {['ADMINISTRADOR', 'ANALISTA_SEGURIDAD', 'AUDITOR'].includes(getUserRole()) && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Crear plan de acción</span>
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por vulnerabilidad o plan..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="text-gray-400 w-5 h-5" />
            <select
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="TODOS">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_PROCESO">En Proceso</option>
              <option value="COMPLETADO">Completado</option>
              <option value="VENCIDO">Vencido</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">Cargando planes...</div>
        ) : filteredPlanes.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No se encontraron planes de acción.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm border-b">
                  <th className="px-4 py-3 font-medium">Vulnerabilidad</th>
                  <th className="px-4 py-3 font-medium">Responsable</th>
                  <th className="px-4 py-3 font-medium">Fecha límite</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlanes.map((plan) => {
                  const sla = getSLAInfo(plan.fecha_limite);
                  return (
                    <tr key={plan.id_plan} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {plan.id_hallazgo}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {usuarios.find(u => u.id_usuario === plan.id_remediador)?.nombre_completo || plan.id_remediador}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(plan.fecha_limite).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusBadgeColor(plan.estado_plan)}`}>
                          {plan.estado_plan?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm ${sla.color}`}>
                        {sla.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Crear Plan de Acción</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vulnerabilidad</label>
                <select
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.id_hallazgo}
                  onChange={(e) => setFormData({ ...formData, id_hallazgo: e.target.value })}
                >
                  <option value="">Seleccione una vulnerabilidad</option>
                  {hallazgos.map(h => (
                    <option key={h.id_hallazgo} value={h.id_hallazgo}>{h.titulo || `Hallazgo #${h.id_hallazgo}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                <select
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.id_remediador}
                  onChange={(e) => setFormData({ ...formData, id_remediador: e.target.value })}
                >
                  <option value="">Seleccione un usuario</option>
                  {usuarios.map(u => (
                    <option key={u.id_usuario} value={u.id_usuario}>{u.nombre_completo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan de acción (Descripción)</label>
                <textarea
                  required
                  rows="3"
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.plan_accion}
                  onChange={(e) => setFormData({ ...formData, plan_accion: e.target.value })}
                  placeholder="Detalle las acciones a realizar..."
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha límite</label>
                <input
                  type="date"
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.fecha_limite}
                  onChange={(e) => setFormData({ ...formData, fecha_limite: e.target.value })}
                />
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="mr-3 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                >
                  Crear Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
