import React, { useState, useEffect } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ShieldAlert, Shield, ShieldCheck, Activity } from 'lucide-react';
import { apiGet } from '../utils/apiClient';

const COLORS_SEVERIDAD = {
  CRITICA: '#EF4444',
  ALTA: '#F97316',
  MEDIA: '#EAB308',
  // Azul 500: suficiente contraste tanto sobre fondo claro como oscuro.
  BAJA: '#60A5FA'
};

/**
 * Hook que observa la clase `dark` en <html> (la misma que togglea el Dashboard)
 * y devuelve true cuando el modo oscuro está activo. Permite que los charts de
 * Recharts, que no heredan estilos de Tailwind, ajusten sus colores por tema.
 */
const useIsDark = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return isDark;
};

const COLORS_SLA = {
  Dentro: '#10B981',
  'En riesgo': '#F59E0B',
  Vencidas: '#EF4444'
};

const COLORS_ESTADO = {
  ABIERTO: '#EF4444',
  EN_PROCESO: '#3B82F6',
  CERRADO: '#10B981'
};

export default function ResumenDashboard() {
  const isDark = useIsDark();
  // Colores de los elementos estructurales del chart (no de los datos) según el tema.
  const chartTheme = isDark
    ? { grid: '#374151', tick: '#9CA3AF', tooltipBg: '#1F2937', tooltipBorder: '#374151', tooltipText: '#F3F4F6' }
    : { grid: '#E5E7EB', tick: '#6B7280', tooltipBg: '#FFFFFF', tooltipBorder: '#E5E7EB', tooltipText: '#111827' };
  const tooltipStyle = {
    backgroundColor: chartTheme.tooltipBg,
    border: `1px solid ${chartTheme.tooltipBorder}`,
    borderRadius: '0.5rem',
    color: chartTheme.tooltipText,
  };

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    criticas: 0,
    altas: 0,
    abiertas: 0,
    riesgoGlobal: 'BAJO'
  });
  const [trendData, setTrendData] = useState([]);
  const [slaData, setSlaData] = useState([]);
  const [estadoData, setEstadoData] = useState([]);

  useEffect(() => {
    fetchData();
    const refreshDashboard = () => fetchData();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    const refreshTimer = window.setInterval(fetchData, 30000);
    window.addEventListener('vulntrack:data-updated', refreshDashboard);
    window.addEventListener('focus', refreshDashboard);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener('vulntrack:data-updated', refreshDashboard);
      window.removeEventListener('focus', refreshDashboard);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const respuestas = await Promise.allSettled([
        apiGet('/api/hallazgos'),
        apiGet('/api/remediacion'),
        apiGet('/api/riesgos')
      ]);
      const [hallazgos, remediaciones, riesgosArr] = respuestas.map(respuesta =>
        respuesta.status === 'fulfilled' ? respuesta.value : []
      );

      let criticas = 0;
      let altas = 0;
      let abiertas = 0;
      let medias = 0;
      let bajas = 0;

      // Estados reales del esquema (en español, tras las migraciones v2/v3) mapeados a
      // las tres categorías del gráfico de dona:
      //  - Abiertas (aún sin plan): DETECTADA, EN_ANALISIS
      //  - En proceso (con plan/remediación en curso): PLANIFICADA, EN_REMEDIACION
      //  - Cerradas (resueltas o descartadas): MITIGADA, CORREGIDA, CERRADA, ACEPTADA, FALSO_POSITIVO
      const ABIERTAS = ['DETECTADA', 'EN_ANALISIS'];
      const EN_PROCESO = ['PLANIFICADA', 'EN_REMEDIACION'];
      const CERRADAS = ['MITIGADA', 'CORREGIDA', 'CERRADA', 'ACEPTADA', 'FALSO_POSITIVO'];

      let estadoCounts = { ABIERTO: 0, EN_PROCESO: 0, CERRADO: 0 };

      if (Array.isArray(hallazgos)) {
        hallazgos.forEach(h => {
          const estado = h.estado_hallazgo;
          // "Abiertas" en la métrica superior = todo lo que aún no está cerrado/descartado.
          if (!CERRADAS.includes(estado)) {
            abiertas++;
          }
          if (h.severidad === 'CRITICA') criticas++;
          if (h.severidad === 'ALTA') altas++;
          if (h.severidad === 'MEDIA') medias++;
          if (h.severidad === 'BAJA') bajas++;

          if (ABIERTAS.includes(estado)) estadoCounts.ABIERTO++;
          else if (EN_PROCESO.includes(estado)) estadoCounts.EN_PROCESO++;
          else if (CERRADAS.includes(estado)) estadoCounts.CERRADO++;
        });
      }

      // Riesgo global real basado en la tabla de riesgos
      let riesgoGlobal = 'BAJO';
      if (Array.isArray(riesgosArr) && riesgosArr.length > 0) {
        const riesgoNiveles = { 'CRITICO': 4, 'ALTO': 3, 'MEDIO': 2, 'BAJO': 1 };
        let maxRiesgo = 0;
        riesgosArr.forEach(r => {
          if (CERRADAS.includes(r.estado_hallazgo)) return;
          const nivel = riesgoNiveles[r.clasificacion] || 0;
          if (nivel > maxRiesgo) maxRiesgo = nivel;
        });
        riesgoGlobal = Object.keys(riesgoNiveles).find(k => riesgoNiveles[k] === maxRiesgo) || 'BAJO';
      } else if (hallazgos.some(h => !CERRADAS.includes(h.estado_hallazgo) && h.severidad === 'CRITICA')) {
        riesgoGlobal = 'CRITICO';
      } else if (hallazgos.some(h => !CERRADAS.includes(h.estado_hallazgo) && h.severidad === 'ALTA')) {
        riesgoGlobal = 'ALTO';
      } else if (hallazgos.some(h => !CERRADAS.includes(h.estado_hallazgo) && h.severidad === 'MEDIA')) {
        riesgoGlobal = 'MEDIO';
      }

      setMetrics({ criticas, altas, abiertas, riesgoGlobal });

      // Tendencia real: agrupar hallazgos por mes de descubrimiento
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const tendenciaPorMes = {};
      if (Array.isArray(hallazgos)) {
        hallazgos.forEach(h => {
          const fecha = new Date(h.fecha_descubrimiento);
          const clave = `${fecha.getFullYear()}-${fecha.getMonth()}`;
          if (!tendenciaPorMes[clave]) {
            tendenciaPorMes[clave] = { name: meses[fecha.getMonth()], Criticas: 0, Altas: 0, Medias: 0, Bajas: 0 };
          }
          if (h.severidad === 'CRITICA') tendenciaPorMes[clave].Criticas++;
          if (h.severidad === 'ALTA') tendenciaPorMes[clave].Altas++;
          if (h.severidad === 'MEDIA') tendenciaPorMes[clave].Medias++;
          if (h.severidad === 'BAJA') tendenciaPorMes[clave].Bajas++;
        });
      }
      const tendenciaArr = Object.values(tendenciaPorMes);
      setTrendData(tendenciaArr.length > 0 ? tendenciaArr : [{ name: meses[new Date().getMonth()], Criticas: criticas, Altas: altas, Medias: medias, Bajas: bajas }]);

      setEstadoData([
        { name: 'Abiertas', value: estadoCounts.ABIERTO },
        { name: 'En proceso', value: estadoCounts.EN_PROCESO },
        { name: 'Cerradas', value: estadoCounts.CERRADO }
      ]);

      // SLA real: calcular desde planes de remediación
      let dentroSLA = 0, enRiesgoSLA = 0, vencidasSLA = 0;
      if (Array.isArray(remediaciones) && remediaciones.length > 0) {
        const hoy = new Date();
        remediaciones.forEach(plan => {
          if (plan.estado_plan === 'COMPLETADO') {
            dentroSLA++;
          } else {
            const limite = new Date(plan.fecha_limite);
            const diasRestantes = Math.ceil((limite - hoy) / (1000 * 60 * 60 * 24));
            if (diasRestantes < 0) vencidasSLA++;
            else if (diasRestantes <= 3) enRiesgoSLA++;
            else dentroSLA++;
          }
        });
      }
      setSlaData([
        { name: 'Dentro', value: dentroSLA || 0 },
        { name: 'En riesgo', value: enRiesgoSLA || 0 },
        { name: 'Vencidas', value: vencidasSLA || 0 }
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiesgoColor = (riesgo) => {
    switch(riesgo) {
      case 'CRITICO': return 'text-red-500';
      case 'ALTO': return 'text-orange-500';
      case 'MEDIO': return 'text-yellow-500';
      case 'BAJO': return 'text-brand-primary';
      default: return 'text-gray-500';
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center items-center h-full">Cargando dashboard...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-brand-accent/30 rounded-lg">
          <Activity className="w-6 h-6 text-brand-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500">Visión general del estado de seguridad</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-medium">Vulnerabilidades críticas</h3>
            <ShieldAlert className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-gray-100">{metrics.criticas}</p>
          <p className="text-xs text-gray-400 mt-1">vs. mes anterior</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-medium">Vulnerabilidades altas</h3>
            <ShieldAlert className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-gray-100">{metrics.altas}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-medium">Vulnerabilidades abiertas</h3>
            <Shield className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-gray-100">{metrics.abiertas}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-medium">Riesgo global</h3>
            <ShieldCheck className="w-5 h-5 text-brand-primary" />
          </div>
          <p className={`text-2xl sm:text-3xl leading-tight break-words font-bold mt-2 ${getRiesgoColor(metrics.riesgoGlobal)}`}>
            {metrics.riesgoGlobal}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 lg:col-span-2">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Tendencia de vulnerabilidades</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTheme.tick, fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: chartTheme.tick, fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: chartTheme.tooltipText }} labelStyle={{ color: chartTheme.tooltipText }} />
                <Legend wrapperStyle={{ color: chartTheme.tick }} />
                <Line type="monotone" dataKey="Criticas" stroke={COLORS_SEVERIDAD.CRITICA} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Altas" stroke={COLORS_SEVERIDAD.ALTA} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Medias" stroke={COLORS_SEVERIDAD.MEDIA} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Bajas" stroke={COLORS_SEVERIDAD.BAJA} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Cumplimiento de SLA</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slaData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {slaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_SLA[entry.name]} stroke={chartTheme.tooltipBg} strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: chartTheme.tooltipText }} labelStyle={{ color: chartTheme.tooltipText }} />
                <Legend wrapperStyle={{ color: chartTheme.tick }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 lg:col-span-3">
          <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Estado de vulnerabilidades</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={estadoData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {estadoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} stroke={chartTheme.tooltipBg} strokeWidth={2} fill={
                      entry.name === 'Abiertas' ? COLORS_ESTADO.ABIERTO :
                      entry.name === 'En proceso' ? COLORS_ESTADO.EN_PROCESO :
                      COLORS_ESTADO.CERRADO
                    } />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: chartTheme.tooltipText }} labelStyle={{ color: chartTheme.tooltipText }} />
                <Legend wrapperStyle={{ color: chartTheme.tick }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
