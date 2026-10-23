import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Activity, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle,
  BarChart,
  FileDown,
  FileType
} from 'lucide-react';
import { apiGet } from '../utils/apiClient';
import { getUserData, tienePermiso } from '../utils/auth';
import { descargarMarkdown, descargarPdf } from '../utils/documentos';

// Calculo cliente de estado SLA (misma logica que getSLAInfo de RemediacionesView):
// un plan con fecha_limite pasada y estado abierto cuenta como vencido.
const esEstadoAbierto = (estado) => !['COMPLETADO', 'CANCELADO'].includes(estado);
const calcularSLA = (fecha_limite, estado_plan) => {
  if (!fecha_limite) return 'Sin fecha';
  const limite = new Date(fecha_limite);
  const hoy = new Date();
  const vencido = limite < hoy && esEstadoAbierto(estado_plan);
  return vencido ? 'Vencido' : 'A tiempo';
};

export default function ReportesView() {
  const [activeTab, setActiveTab] = useState('ejecutivos');
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activos, setActivos] = useState([]);
  const [selectedActivo, setSelectedActivo] = useState('');

  React.useEffect(() => {
    const fetchActivos = async () => {
      try {
        if (tienePermiso('VER_ACTIVOS')) {
          const data = await apiGet('/api/activos');
          setActivos(data);
        }
      } catch (error) {
        console.error("Error fetching activos:", error);
      }
    };
    fetchActivos();
  }, []);

  const reports = [
    {
      id: 'ejecutivo',
      title: 'Reporte ejecutivo',
      description: 'Resumen de estado y métricas clave.',
      icon: Activity,
      iconColor: 'text-brand-primary',
      bgColor: 'bg-brand-accent/20',
      type: 'ejecutivos',
      endpoint: '/api/dashboard/metricas'
    },
    {
      id: 'vulnerabilidades',
      title: 'Reporte de vulnerabilidades',
      description: 'Detalle técnico por CVE y activos.',
      icon: ShieldAlert,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      type: 'tecnicos',
      endpoint: '/api/hallazgos'
    },
    {
      id: 'riesgos',
      title: 'Reporte de riesgos',
      description: 'Matriz y análisis de riesgo.',
      icon: AlertTriangle,
      iconColor: 'text-brand-secondary',
      bgColor: 'bg-brand-secondary/10',
      type: 'tecnicos',
      endpoint: '/api/riesgos'
    },
    {
      id: 'sla',
      title: 'Reporte de cumplimiento SLA',
      description: 'Tiempos y estados de remediación.',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
      type: 'ejecutivos',
      endpoint: '/api/remediacion'
    }
  ];

  const handleGenerateReport = async (report) => {
    setSelectedReport(report);
    setLoading(true);
    setReportData(null);
    try {
      const url = selectedActivo ? `${report.endpoint}?id_activo=${selectedActivo}` : report.endpoint;
      const data = await apiGet(url);
      setReportData(data);
    } catch (error) {
      console.error(error);
      setReportData({ error: error.message || 'No se pudo cargar la información del reporte.' });
    } finally {
      setLoading(false);
    }
  };

  // Encabezado comun: quien genera + fecha. El nombre de empresa NO esta en el
  // JWT, por eso el encabezado de los reportes usa nombre_completo del usuario.
  const encabezadoComun = () => {
    const usuario = getUserData();
    const nombre = usuario?.nombre_completo || 'Usuario';
    return `Generado por: ${nombre} - ${new Date().toLocaleString('es-CO')}`;
  };

  // Obtiene los datos del reporte respetando el filtro selectedActivo para los
  // endpoints que lo aceptan (metricas, hallazgos, remediacion).
  const obtenerDatosReporte = async (report) => {
    const aceptaActivo = ['ejecutivo', 'vulnerabilidades', 'sla'].includes(report.id);
    const url = (aceptaActivo && selectedActivo)
      ? `${report.endpoint}?id_activo=${selectedActivo}`
      : report.endpoint;
    return apiGet(url);
  };

  // Arma { titulo, md, pdf } para un reporte dado a partir de sus datos.
  // pdf es la estructura { titulo, fecha, secciones[] } que consume descargarPdf.
  const construirContenido = (report, data) => {
    const encabezado = encabezadoComun();
    const titulo = report.title;

    if (report.id === 'ejecutivo') {
      const metricas = data || {};
      const totalActivos = metricas.metricas_generales?.total_activos ?? 'N/D';
      const porSeveridad = metricas.graficas?.hallazgos_severidad || [];
      const porEstadoPlan = metricas.graficas?.estado_remediacion || [];
      const alertas = metricas.alertas_recientes || [];

      const md = `# ${titulo}\n\n${encabezado}\n\n` +
        `## Resumen\n- Total de activos: ${totalActivos}\n\n` +
        `## Hallazgos por severidad\n` +
        (porSeveridad.length
          ? porSeveridad.map(s => `- ${s.severidad}: ${s.cantidad}`).join('\n')
          : '_Sin datos_') + `\n\n` +
        `## Planes por estado\n` +
        (porEstadoPlan.length
          ? porEstadoPlan.map(e => `- ${e.estado_plan}: ${e.cantidad}`).join('\n')
          : '_Sin datos_') + `\n\n` +
        `## Alertas recientes\n` +
        (alertas.length
          ? alertas.map(a => `- ${a.titulo || a.cve_id || JSON.stringify(a)}`).join('\n')
          : '_Sin datos_') + `\n`;

      const pdf = {
        titulo,
        fecha: encabezado,
        secciones: [
          { encabezado: 'Resumen', parrafos: [`Total de activos: ${totalActivos}`] },
          {
            encabezado: 'Hallazgos por severidad',
            tabla: porSeveridad.length
              ? { columnas: ['Severidad', 'Cantidad'], filas: porSeveridad.map(s => [s.severidad, s.cantidad]) }
              : undefined,
            parrafos: porSeveridad.length ? [] : ['Sin datos']
          },
          {
            encabezado: 'Planes por estado',
            tabla: porEstadoPlan.length
              ? { columnas: ['Estado', 'Cantidad'], filas: porEstadoPlan.map(e => [e.estado_plan, e.cantidad]) }
              : undefined,
            parrafos: porEstadoPlan.length ? [] : ['Sin datos']
          },
          {
            encabezado: 'Alertas recientes',
            parrafos: alertas.length
              ? alertas.map(a => `- ${a.titulo || a.cve_id || JSON.stringify(a)}`)
              : ['Sin datos']
          }
        ]
      };
      return { titulo, md, pdf };
    }

    if (report.id === 'vulnerabilidades') {
      const filas = Array.isArray(data) ? data : [];
      const columnas = ['CVE', 'Activo', 'Severidad', 'CVSS', 'Estado'];
      const filasTabla = filas.map(h => [
        h.cve_id || 'N/D',
        h.activo_nombre || 'N/D',
        h.severidad || 'N/D',
        h.cvss != null ? h.cvss : 'N/D',
        h.estado_hallazgo || 'N/D'
      ]);
      const md = `# ${titulo}\n\n${encabezado}\n\n` +
        (filasTabla.length
          ? `| ${columnas.join(' | ')} |\n| ${columnas.map(() => '---').join(' | ')} |\n` +
            filasTabla.map(f => `| ${f.join(' | ')} |`).join('\n') + '\n'
          : '_Sin datos_\n');
      const pdf = {
        titulo,
        fecha: encabezado,
        secciones: [{
          encabezado: 'Vulnerabilidades',
          tabla: filasTabla.length ? { columnas, filas: filasTabla } : undefined,
          parrafos: filasTabla.length ? [] : ['Sin datos']
        }]
      };
      return { titulo, md, pdf };
    }

    if (report.id === 'riesgos') {
      const filas = Array.isArray(data) ? data : [];
      const columnas = ['CVE', 'Activo', 'Probabilidad', 'Impacto', 'Puntaje', 'Clasificacion', 'Evaluador'];
      const filasTabla = filas.map(r => [
        r.cve_id || 'N/D',
        r.activo || r.activo_nombre || 'N/D',
        r.probabilidad != null ? r.probabilidad : 'N/D',
        r.impacto != null ? r.impacto : 'N/D',
        r.puntaje != null ? r.puntaje : 'N/D',
        r.clasificacion || 'N/D',
        r.evaluador || 'N/D'
      ]);
      const md = `# ${titulo}\n\n${encabezado}\n\n` +
        (filasTabla.length
          ? `| ${columnas.join(' | ')} |\n| ${columnas.map(() => '---').join(' | ')} |\n` +
            filasTabla.map(f => `| ${f.join(' | ')} |`).join('\n') + '\n'
          : '_Sin datos_\n');
      const pdf = {
        titulo,
        fecha: encabezado,
        secciones: [{
          encabezado: 'Riesgos',
          tabla: filasTabla.length ? { columnas, filas: filasTabla } : undefined,
          parrafos: filasTabla.length ? [] : ['Sin datos']
        }]
      };
      return { titulo, md, pdf };
    }

    // SLA
    const filas = Array.isArray(data) ? data : [];
    const columnas = ['Nombre', 'Prioridad', 'Fecha limite', 'Estado', 'Responsable', 'SLA'];
    const filasTabla = filas.map(p => [
      p.nombre || 'N/D',
      p.prioridad || 'N/D',
      p.fecha_limite ? new Date(p.fecha_limite).toLocaleDateString('es-CO') : 'N/D',
      p.estado_plan || 'N/D',
      p.responsable || 'Sin Asignar',
      calcularSLA(p.fecha_limite, p.estado_plan)
    ]);
    const md = `# ${titulo}\n\n${encabezado}\n\n` +
      (filasTabla.length
        ? `| ${columnas.join(' | ')} |\n| ${columnas.map(() => '---').join(' | ')} |\n` +
          filasTabla.map(f => `| ${f.join(' | ')} |`).join('\n') + '\n'
        : '_Sin datos_\n');
    const pdf = {
      titulo,
      fecha: encabezado,
      secciones: [{
        encabezado: 'Cumplimiento SLA',
        tabla: filasTabla.length ? { columnas, filas: filasTabla } : undefined,
        parrafos: filasTabla.length ? [] : ['Sin datos']
      }]
    };
    return { titulo, md, pdf };
  };

  // Descarga Markdown de un reporte: obtiene datos frescos (respetando el
  // filtro) y arma el .md por tipo.
  const handleDescargarMarkdown = async (report, e) => {
    if (e) e.stopPropagation();
    try {
      const data = await obtenerDatosReporte(report);
      const { titulo, md } = construirContenido(report, data);
      descargarMarkdown(titulo, md);
    } catch (error) {
      console.error(error);
      alert(error.message || 'No se pudo generar el reporte en Markdown.');
    }
  };

  // Exporta un reporte a PDF con jsPDF.
  const handleExportarPdf = async (report, e) => {
    if (e) e.stopPropagation();
    try {
      const data = await obtenerDatosReporte(report);
      const { titulo, pdf } = construirContenido(report, data);
      descargarPdf(titulo, pdf);
    } catch (error) {
      console.error(error);
      alert(error.message || 'No se pudo exportar el reporte a PDF.');
    }
  };

  const filteredReports = reports.filter(r => 
    activeTab === 'todos' || r.type === activeTab || (activeTab === 'ejecutivos' && r.type === 'ejecutivos') || (activeTab === 'tecnicos' && r.type === 'tecnicos')
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-accent/30 rounded-lg">
              <FileText className="w-6 h-6 text-brand-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reportes</h1>
          </div>
          <p className="mt-2 text-gray-500">
            Genera y visualiza reportes del estado de seguridad y cumplimiento.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedActivo}
            onChange={(e) => setSelectedActivo(e.target.value)}
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm bg-white dark:bg-gray-800"
          >
            <option value="">Todos los activos</option>
            {activos.map(a => (
              <option key={a.id_activo} value={a.id_activo}>
                {a.nombre} - {a.ip_address}
              </option>
            ))}
          </select>
          <button 
            onClick={() => handleGenerateReport(reports[0])}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary font-medium flex items-center shadow-sm whitespace-nowrap"
          >
            <BarChart className="w-4 h-4 mr-2" />
            + Generar reporte
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('ejecutivos')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'ejecutivos'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-600'
            }`}
          >
            Ejecutivos
          </button>
          <button
            onClick={() => setActiveTab('tecnicos')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tecnicos'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-600'
            }`}
          >
            Técnicos
          </button>
        </nav>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          const isSelected = selectedReport?.id === report.id;
          
          return (
            <div 
              key={report.id}
              onClick={() => handleGenerateReport(report)}
              className={`p-6 bg-white dark:bg-gray-800 rounded-xl border cursor-pointer transition-all ${
                isSelected ? 'border-brand-primary shadow-md ring-1 ring-brand-primary' : 'border-gray-200 dark:border-gray-700 shadow-sm hover:border-brand-primary hover:shadow-md'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex space-x-4">
                  <div className={`p-3 rounded-xl ${report.bgColor}`}>
                    <Icon className={`w-6 h-6 ${report.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{report.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                  </div>
                </div>
                <div className="text-gray-400 bg-brand-light dark:bg-gray-900 p-2 rounded-full">
                  <Download className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={(e) => handleDescargarMarkdown(report, e)}
                  className="flex items-center text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-primary hover:text-brand-primary transition-colors"
                >
                  <FileDown className="w-4 h-4 mr-1.5" />
                  Descargar Markdown
                </button>
                <button
                  onClick={(e) => handleExportarPdf(report, e)}
                  className="flex items-center text-sm px-3 py-1.5 rounded-lg bg-brand-primary text-white hover:bg-brand-secondary transition-colors"
                >
                  <FileType className="w-4 h-4 mr-1.5" />
                  Exportar a PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedReport && (
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-brand-light dark:bg-gray-900 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
              <selectedReport.icon className={`w-5 h-5 mr-2 ${selectedReport.iconColor}`} />
              Vista Previa: {selectedReport.title}
            </h3>
            <button
              onClick={() => handleExportarPdf(selectedReport)}
              className="text-sm text-brand-primary font-medium hover:text-brand-secondary flex items-center"
            >
              Exportar a PDF
              <FileType className="w-4 h-4 ml-1" />
            </button>
          </div>
          
          <div className="p-6 min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                <p>Generando datos del reporte...</p>
              </div>
            ) : reportData?.error ? (
              <div className="text-center text-red-500 p-8 bg-red-50 rounded-lg">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                {reportData.error}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">Datos del reporte extraídos exitosamente.</p>
                {selectedReport.id === 'ejecutivo' && reportData && !Array.isArray(reportData) ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(reportData).map(([key, value]) => (
                      <div key={key} className="bg-brand-light dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                        <div className="text-xs text-gray-500 uppercase font-bold mb-1">{key.replace(/_/g, ' ')}</div>
                        <div className="text-2xl font-black text-gray-900 dark:text-gray-100">{typeof value === 'object' ? Object.keys(value).length : value}</div>
                      </div>
                    ))}
                  </div>
                ) : Array.isArray(reportData) && reportData.length > 0 ? (
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-brand-light dark:bg-gray-900 text-gray-600 dark:text-gray-400">
                        <tr>
                          {Object.keys(reportData[0]).slice(0, 5).map(k => (
                            <th key={k} className="px-4 py-3 font-medium uppercase text-xs">{k.replace(/_/g, ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {reportData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-brand-light dark:hover:bg-gray-900">
                            {Object.values(row).slice(0, 5).map((val, vIdx) => (
                              <td key={vIdx} className="px-4 py-3 text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">No hay datos disponibles para este reporte.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
