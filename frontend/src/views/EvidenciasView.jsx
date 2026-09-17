import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Calendar,
  FileText,
  Camera,
  Clock,
  Route
} from 'lucide-react';

export default function EvidenciasView() {
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('Todos los módulos');

  const modules = [
    'Todos los módulos',
    'Activos',
    'Vulnerabilidades',
    'Riesgos',
    'Remediación',
    'Usuarios'
  ];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('vulntrack_token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch users to map IDs to names
        const usersRes = await fetch('http://localhost:3000/api/usuarios', { headers });
        let usersMap = {};
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          usersData.forEach(u => {
            usersMap[u.id_usuario] = u.nombre_completo;
          });
          setUsers(usersMap);
        }

        // Fetch audit logs
        const auditRes = await fetch('http://localhost:3000/api/auditoria', { headers });
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setEvents(auditData);
        }
      } catch (error) {
        console.error("Error fetching audit data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredEvents = events.filter(ev => {
    const matchesModule = moduleFilter === 'Todos los módulos' || ev.modulo === moduleFilter;
    const userName = users[ev.id_usuario] || 'Usuario Desconocido';
    const matchesSearch = 
      userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.accion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ev.modulo && ev.modulo.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesModule && matchesSearch;
  });

  const cards = [
    { title: 'Archivos', icon: FileText, desc: 'Documentos adjuntos' },
    { title: 'Capturas', icon: Camera, desc: 'Evidencias visuales' },
    { title: 'Historial', icon: Clock, desc: 'Línea de tiempo' },
    { title: 'Trazabilidad', icon: Route, desc: 'Flujo de cambios' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-900 p-6 rounded-2xl">
          <div className="col-span-1 md:col-span-4 mb-2">
            <h2 className="text-xl font-bold text-white flex items-center">
              <ShieldCheck className="w-6 h-6 mr-2 text-blue-400" />
              Toda la trazabilidad, en un solo lugar.
            </h2>
          </div>
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div key={idx} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col items-center justify-center text-center">
                <div className="p-3 bg-gray-700 rounded-full mb-3">
                  <Icon className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-white font-medium">{card.title}</h3>
                <p className="text-gray-400 text-xs mt-1">{card.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <ShieldCheck className="w-6 h-6 mr-3 text-blue-600" />
          Evidencias y Auditoría
        </h1>
        <p className="mt-2 text-gray-500">Historial de cambios y registro de acciones del sistema.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-1 gap-4 w-full md:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por usuario o acción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
            >
              {modules.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 w-full md:w-auto">
          <Calendar className="w-4 h-4" />
          <span>Últimos 30 días</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
                <th className="px-6 py-4 font-medium">Fecha / Hora</th>
                <th className="px-6 py-4 font-medium">Usuario</th>
                <th className="px-6 py-4 font-medium">Acción</th>
                <th className="px-6 py-4 font-medium">Módulo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    Cargando historial...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    No se encontraron registros de auditoría.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev, index) => (
                  <tr key={ev.id_evento || index} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 text-gray-500 font-medium">
                      {formatDate(ev.fecha_evento)}
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      {users[ev.id_usuario] || `Usuario ${ev.id_usuario}`}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {ev.accion}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {ev.modulo || 'Sistema'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
