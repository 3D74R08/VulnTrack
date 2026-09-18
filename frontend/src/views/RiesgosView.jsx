import React, { useState, useEffect } from 'react';
import { Target, Plus, X } from 'lucide-react';
import { getUserRole } from '../utils/auth';

export default function RiesgosView() {
  const [riesgos, setRiesgos] = useState([]);
  const [hallazgos, setHallazgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id_hallazgo: '', probabilidad: 'BAJA', impacto: 'BAJO' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('vulntrack_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [riesgosRes, hallazgosRes] = await Promise.all([
        fetch('http://localhost:3000/api/riesgos', { headers }),
        fetch('http://localhost:3000/api/hallazgos', { headers })
      ]);

      if (riesgosRes.ok) setRiesgos(await riesgosRes.json());
      if (hallazgosRes.ok) setHallazgos(await hallazgosRes.json());
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
      const res = await fetch('http://localhost:3000/api/riesgos', {
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
        setFormData({ id_hallazgo: '', probabilidad: 'BAJA', impacto: 'BAJO' });
      }
    } catch (error) {
      console.error('Error creating riesgo:', error);
    }
  };

  const probabilidadLevels = ['BAJA', 'MEDIA', 'ALTA', 'MUY_ALTA'];
  const impactoLevels = ['CRITICO', 'ALTO', 'MEDIO', 'BAJO']; // Top to bottom

  const getMatrixCellColor = (impacto, probabilidad) => {
    const gridColors = {
      'CRITICO': { 'BAJA': 'bg-orange-500', 'MEDIA': 'bg-red-500', 'ALTA': 'bg-red-500', 'MUY_ALTA': 'bg-red-500' },
      'ALTO': { 'BAJA': 'bg-yellow-500', 'MEDIA': 'bg-orange-500', 'ALTA': 'bg-red-500', 'MUY_ALTA': 'bg-red-500' },
      'MEDIO': { 'BAJA': 'bg-green-500', 'MEDIA': 'bg-yellow-500', 'ALTA': 'bg-orange-500', 'MUY_ALTA': 'bg-red-500' },
      'BAJO': { 'BAJA': 'bg-green-500', 'MEDIA': 'bg-green-500', 'ALTA': 'bg-yellow-500', 'MUY_ALTA': 'bg-orange-500' }
    };
    return gridColors[impacto][probabilidad];
  };

  const getRiesgosInCell = (impacto, probabilidad) => {
    return riesgos.filter(r => r.impacto === impacto && r.probabilidad === probabilidad).length;
  };

  const stats = {
    total: riesgos.length,
    criticos: riesgos.filter(r => ['CRITICO'].includes(r.riesgo_global)).length,
    altos: riesgos.filter(r => ['ALTO'].includes(r.riesgo_global)).length,
    medios: riesgos.filter(r => ['MEDIO'].includes(r.riesgo_global)).length,
    bajos: riesgos.filter(r => ['BAJO'].includes(r.riesgo_global)).length,
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <Target className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-800">Evaluación y Gestión de Riesgos</h1>
        </div>
        {['ADMINISTRADOR', 'ANALISTA_SEGURIDAD'].includes(getUserRole()) && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Evaluar riesgo</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10">Cargando datos...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Matriz de Riesgos</h2>
            <div className="min-w-[500px]">
              <div className="flex">
                <div className="w-24 flex-shrink-0 flex flex-col justify-center items-center font-semibold text-gray-500 text-sm transform -rotate-90">
                  IMPACTO
                </div>
                <div className="flex-1">
                  <div className="grid grid-rows-4 gap-1">
                    {impactoLevels.map((impacto) => (
                      <div key={impacto} className="flex h-20 items-center">
                        <div className="w-24 text-right pr-4 text-xs font-medium text-gray-600">{impacto.replace('_', ' ')}</div>
                        <div className="flex-1 grid grid-cols-4 gap-1 h-full">
                          {probabilidadLevels.map((probabilidad) => {
                            const count = getRiesgosInCell(impacto, probabilidad);
                            const bgColor = getMatrixCellColor(impacto, probabilidad);
                            return (
                              <div
                                key={`${impacto}-${probabilidad}`}
                                className={`relative flex items-center justify-center ${bgColor} rounded-sm opacity-80 hover:opacity-100 transition-opacity`}
                                title={`Impacto: ${impacto}, Probabilidad: ${probabilidad} - ${count} riesgos`}
                              >
                                {count > 0 && (
                                  <div className="bg-white text-gray-800 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                                    {count}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex mt-2">
                    <div className="w-24"></div>
                    <div className="flex-1 grid grid-cols-4 gap-1 text-center text-xs font-medium text-gray-600">
                      {probabilidadLevels.map(p => <div key={p}>{p.replace('_', ' ')}</div>)}
                    </div>
                  </div>
                  <div className="text-center mt-2 font-semibold text-gray-500 text-sm ml-24">
                    PROBABILIDAD
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 text-gray-700">Resumen Global</h2>
              <div className="text-center mb-6">
                <div className="text-sm text-gray-500 mb-1">Riesgo global predominante</div>
                <div className="text-2xl font-bold text-red-500">
                  {stats.criticos > 0 ? 'CRITICO' : stats.altos > 0 ? 'ALTO' : stats.medios > 0 ? 'MEDIO' : 'BAJO'}
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600 font-medium">Total de riesgos</span>
                <span className="text-xl font-bold">{stats.total}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm text-gray-600">Críticos</span>
                </div>
                <span className="font-semibold">{stats.criticos}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-sm text-gray-600">Altos</span>
                </div>
                <span className="font-semibold">{stats.altos}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm text-gray-600">Medios</span>
                </div>
                <span className="font-semibold">{stats.medios}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-600">Bajos</span>
                </div>
                <span className="font-semibold">{stats.bajos}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Evaluar Riesgo</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hallazgo / Vulnerabilidad</label>
                <select
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.id_hallazgo}
                  onChange={(e) => setFormData({ ...formData, id_hallazgo: e.target.value })}
                >
                  <option value="">Seleccione una vulnerabilidad</option>
                  {hallazgos.map(h => (
                    <option key={h.id_hallazgo} value={h.id_hallazgo}>{h.titulo || `CVE / Hallazgo #${h.id_hallazgo}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Probabilidad</label>
                <select
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.probabilidad}
                  onChange={(e) => setFormData({ ...formData, probabilidad: e.target.value })}
                >
                  {probabilidadLevels.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Impacto</label>
                <select
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.impacto}
                  onChange={(e) => setFormData({ ...formData, impacto: e.target.value })}
                >
                  {impactoLevels.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
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
                  Guardar Evaluación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
