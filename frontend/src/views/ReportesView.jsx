import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Activity, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle,
  BarChart,
  ChevronRight
} from 'lucide-react';

export default function ReportesView() {
  const [activeTab, setActiveTab] = useState('ejecutivos');
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const reports = [
    {
      id: 'ejecutivo',
      title: 'Reporte ejecutivo',
      description: 'Resumen de estado y métricas clave.',
      icon: Activity,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
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
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
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
      const token = localStorage.getItem('vulntrack_token');
      const res = await fetch(`http://localhost:3000${report.endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      } else {
        setReportData({ error: 'No se pudo cargar la información del reporte.' });
      }
    } catch (error) {
      console.error(error);
      setReportData({ error: 'Error al conectar con el servidor.' });
    } finally {
      setLoading(false);
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
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          </div>
          <p className="mt-2 text-gray-500">
            Genera y visualiza reportes del estado de seguridad y cumplimiento.
          </p>
        </div>
        <button 
          onClick={() => handleGenerateReport(reports[0])}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center shadow-sm"
        >
          <BarChart className="w-4 h-4 mr-2" />
          + Generar reporte
        </button>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('ejecutivos')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'ejecutivos'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Ejecutivos
          </button>
          <button
            onClick={() => setActiveTab('tecnicos')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tecnicos'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
              className={`p-6 bg-white rounded-xl border cursor-pointer transition-all ${
                isSelected ? 'border-blue-500 shadow-md ring-1 ring-blue-500' : 'border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex space-x-4">
                  <div className={`p-3 rounded-xl ${report.bgColor}`}>
                    <Icon className={`w-6 h-6 ${report.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{report.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                  </div>
                </div>
                <div className="text-gray-400 hover:text-blue-600 bg-gray-50 p-2 rounded-full">
                  <Download className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedReport && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <selectedReport.icon className={`w-5 h-5 mr-2 ${selectedReport.iconColor}`} />
              Vista Previa: {selectedReport.title}
            </h3>
            <button className="text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center">
              Exportar a PDF
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          
          <div className="p-6 min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p>Generando datos del reporte...</p>
              </div>
            ) : reportData?.error ? (
              <div className="text-center text-red-500 p-8 bg-red-50 rounded-lg">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                {reportData.error}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">Datos extraídos exitosamente. (Vista simplificada para MVP)</p>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto max-h-96">
                  <pre>{JSON.stringify(reportData, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
