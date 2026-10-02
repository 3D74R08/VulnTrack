import React, { useState, useEffect } from 'react';
import { TriangleAlert, Search, Plus, X } from 'lucide-react';
import { getUserRole } from '../utils/auth';

export default function VulnerabilidadesView() {
  const [hallazgos, setHallazgos] = useState([]);
  const [activos, setActivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeveridad, setFilterSeveridad] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nvdLoading, setNvdLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    cve_id: '',
    titulo: '',
    descripcion: '',
    severidad: 'MEDIA',
    cvss: '',
    id_activo: '',
    estado: 'ABIERTO' // or estado_hallazgo depending on DB
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('vulntrack_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [hallazgosRes, activosRes] = await Promise.all([
        fetch('http://localhost:3000/api/hallazgos', { headers }),
        fetch('http://localhost:3000/api/activos', { headers })
      ]);

      const hData = await hallazgosRes.json();
      const aData = await activosRes.json();

      if (Array.isArray(hData)) setHallazgos(hData);
      if (Array.isArray(aData)) setActivos(aData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNvdSearch = async () => {
    if (!formData.cve_id) return;
    setNvdLoading(true);
    try {
      const token = localStorage.getItem('vulntrack_token');
      const res = await fetch(`http://localhost:3000/api/hallazgos/nvd/${formData.cve_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        let mappedSeveridad = 'MEDIA';
        if (data.severidad) {
          const s = data.severidad.toUpperCase();
          if (s === 'CRITICAL') mappedSeveridad = 'CRITICA';
          else if (s === 'HIGH') mappedSeveridad = 'ALTA';
          else if (s === 'MEDIUM') mappedSeveridad = 'MEDIA';
          else if (s === 'LOW') mappedSeveridad = 'BAJA';
        }

        setFormData({
          ...formData,
          titulo: formData.titulo || `Vulnerabilidad ${data.cve_id}`,
          descripcion: data.descripcion || '',
          severidad: mappedSeveridad,
          cvss: data.cvss || ''
        });
      }
    } catch (error) {
      console.error('Error fetching NVD data:', error);
      alert('Error consultando NVD');
    } finally {
      setNvdLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('vulntrack_token');
      const res = await fetch('http://localhost:3000/api/hallazgos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          titulo: formData.titulo,
          descripcion: formData.descripcion,
          cve_id: formData.cve_id,
          severidad: formData.severidad,
          cvss: parseFloat(formData.cvss) || null,
          id_activo: formData.id_activo
        })
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ cve_id: '', titulo: '', descripcion: '', severidad: 'MEDIA', cvss: '', id_activo: '', estado: 'ABIERTO' });
        fetchData();
      }
    } catch (error) {
      console.error('Error creating hallazgo:', error);
    }
  };

  const getSeveridadColor = (sev) => {
    switch (sev) {
      case 'CRITICA': return 'bg-red-100 text-red-800';
      case 'ALTA': return 'bg-orange-100 text-orange-800';
      case 'MEDIA': return 'bg-yellow-100 text-yellow-800';
      case 'BAJA': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredHallazgos = hallazgos.filter(h => {
    const matchesSearch = (h.cve_id?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (h.titulo?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesSev = filterSeveridad ? h.severidad === filterSeveridad : true;
    const matchesEst = filterEstado ? (h.estado_hallazgo === filterEstado) : true;
    
    return matchesSearch && matchesSev && matchesEst;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <TriangleAlert className="w-6 h-6 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Vulnerabilidades</h1>
        </div>
        {['ADMINISTRADOR', 'AUDITOR'].includes(getUserRole()) && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Registrar vulnerabilidad
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por CVE o título..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={filterSeveridad}
            onChange={(e) => setFilterSeveridad(e.target.value)}
          >
            <option value="">Todas las severidades</option>
            <option value="CRITICA">Crítica</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </select>
          <select 
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="ABIERTO">Abierto</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="MITIGADO">Mitigado</option>
            <option value="FALSO_POSITIVO">Falso positivo</option>
            <option value="CERRADO">Cerrado</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">CVE/ID</th>
                <th className="px-6 py-3">Título</th>
                <th className="px-6 py-3">Severidad</th>
                <th className="px-6 py-3">CVSS</th>
                <th className="px-6 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="5" className="text-center py-8">Cargando...</td></tr>
              ) : filteredHallazgos.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-8">No se encontraron vulnerabilidades.</td></tr>
              ) : (
                filteredHallazgos.map(h => (
                  <tr key={h.id_hallazgo} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{h.cve_id || `VULN-${h.id_hallazgo}`}</td>
                    <td className="px-6 py-4 text-gray-700 truncate max-w-[200px]" title={h.titulo}>{h.titulo}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeveridadColor(h.severidad)}`}>
                        {h.severidad}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{h.cvss || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {h.estado_hallazgo?.replace('_', ' ') || 'ABIERTO'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Registrar vulnerabilidad</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-1">CVE ID del NVD (Obligatorio)</label>
                <div className="flex gap-2">
                  <input 
                    required
                    type="text" 
                    placeholder="Ej: CVE-2023-1234"
                    className="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.cve_id}
                    onChange={e => setFormData({...formData, cve_id: e.target.value})}
                  />
                  <button 
                    type="button"
                    onClick={handleNvdSearch}
                    disabled={nvdLoading}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    {nvdLoading ? 'Buscando...' : 'Buscar NVD'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input required type="text" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea rows="3" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severidad</label>
                  <select className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.severidad} onChange={e => setFormData({...formData, severidad: e.target.value})}>
                    <option value="CRITICA">Crítica</option>
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Media</option>
                    <option value="BAJA">Baja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CVSS Score</label>
                  <input type="number" step="0.1" min="0" max="10" className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.cvss} onChange={e => setFormData({...formData, cvss: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Activo Afectado</label>
                <select required className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.id_activo} onChange={e => setFormData({...formData, id_activo: e.target.value})}>
                  <option value="">Seleccione un activo...</option>
                  {activos.map(a => (
                    <option key={a.id_activo} value={a.id_activo}>{a.nombre} ({a.tipo})</option>
                  ))}
                </select>
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
