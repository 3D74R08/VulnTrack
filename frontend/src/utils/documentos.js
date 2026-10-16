// Helper compartido de generacion de documentos (Markdown + PDF) de VulnTrack.
//
// Reutilizado por:
//  - ReportesView.jsx (Bloque D): reportes descargables en .md y .pdf.
//  - La aceptacion de riesgo (Bloque C, FEAT-003): genera el acta en .pdf con
//    la firma estampada a traves de generarActaAceptacion(payload).
//
// La generacion de PDF vive en el cliente con jsPDF (ESM puro, texto nativo
// seleccionable y estampado de la firma PNG con doc.addImage). No se renderiza
// DOM oculto ni se rasteriza con html2canvas.
//
// API publica estable (consumida por FEAT-003, NO cambiar firmas):
//   descargarArchivo(nombre, contenido, mime)
//   descargarMarkdown(nombre, md)
//   descargarPdf(nombre, { titulo, empresa, fecha, secciones, firma })
//   generarActaAceptacion(payload)

import { jsPDF } from 'jspdf';

// -------------------------------------------------------------------------
// Saneado de nombres de archivo: sin espacios ni caracteres raros.
// Deja letras/numeros/._- y colapsa el resto a guion bajo.
// -------------------------------------------------------------------------
export const sanearNombre = (nombre) => {
  const base = String(nombre || 'documento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quita tildes/diacriticos
    .replace(/[^a-zA-Z0-9._-]+/g, '_') // el resto a guion bajo
    .replace(/_+/g, '_')               // colapsa guiones bajos repetidos
    .replace(/^_+|_+$/g, '');          // recorta extremos
  return base || 'documento';
};

// -------------------------------------------------------------------------
// Descarga generica via Blob + <a download>. Dispara un archivo real.
// -------------------------------------------------------------------------
export const descargarArchivo = (nombre, contenido, mime) => {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
};

// -------------------------------------------------------------------------
// Descarga de Markdown: antepone .md y usa mime text/markdown.
// -------------------------------------------------------------------------
export const descargarMarkdown = (nombre, md) => {
  const archivo = `${sanearNombre(nombre)}.md`;
  descargarArchivo(archivo, md, 'text/markdown');
};

// -------------------------------------------------------------------------
// descargarPdf: construye un PDF con jsPDF a partir de una estructura simple.
//
//   nombre: nombre base del archivo (se sanea y se le anade .pdf).
//   doc:
//     titulo    string   titulo principal del documento.
//     empresa   string   (opcional) linea de empresa bajo el titulo.
//     fecha     string   (opcional) linea de fecha/metadato bajo el titulo.
//     secciones [{ encabezado, parrafos?:[], tabla?:{ columnas:[], filas:[[]] } }]
//     firma     string   (opcional) dataURL PNG para estampar al final.
//
// Maneja control de altura y salto de pagina automatico.
// -------------------------------------------------------------------------
export const descargarPdf = (nombre, { titulo, empresa, fecha, secciones = [], firma } = {}) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const margen = 40;
  const anchoUtil = anchoPagina - margen * 2;
  let y = margen;

  // Asegura que queda espacio vertical; si no, abre pagina nueva.
  const asegurarEspacio = (alto) => {
    if (y + alto > altoPagina - margen) {
      doc.addPage();
      y = margen;
    }
  };

  // Escribe texto con ajuste de linea y salto de pagina por cada linea.
  const escribirTexto = (texto, { size = 10, style = 'normal', interlineado = 14 } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lineas = doc.splitTextToSize(String(texto ?? ''), anchoUtil);
    for (const linea of lineas) {
      asegurarEspacio(interlineado);
      doc.text(linea, margen, y);
      y += interlineado;
    }
  };

  // --- Titulo y metadatos ---
  escribirTexto(titulo || 'Documento', { size: 18, style: 'bold', interlineado: 22 });
  if (empresa) escribirTexto(empresa, { size: 11, style: 'bold', interlineado: 15 });
  if (fecha) escribirTexto(fecha, { size: 9, style: 'normal', interlineado: 13 });
  y += 6;

  // --- Secciones ---
  for (const seccion of secciones) {
    if (!seccion) continue;
    y += 6;
    if (seccion.encabezado) {
      escribirTexto(seccion.encabezado, { size: 13, style: 'bold', interlineado: 18 });
    }

    // Parrafos
    for (const parrafo of seccion.parrafos || []) {
      escribirTexto(parrafo, { size: 10, style: 'normal', interlineado: 14 });
    }

    // Tabla simple (columnas + filas) dibujada con doc.text por columna.
    const tabla = seccion.tabla;
    if (tabla && Array.isArray(tabla.columnas) && tabla.columnas.length > 0) {
      const columnas = tabla.columnas;
      const filas = tabla.filas || [];
      const anchoCol = anchoUtil / columnas.length;
      const interlineado = 13;

      // Encabezado de la tabla
      asegurarEspacio(interlineado);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      columnas.forEach((col, i) => {
        const celda = doc.splitTextToSize(String(col ?? ''), anchoCol - 4)[0] || '';
        doc.text(celda, margen + i * anchoCol, y);
      });
      y += interlineado;

      // Filas
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      for (const fila of filas) {
        asegurarEspacio(interlineado);
        columnas.forEach((_, i) => {
          const valor = fila[i] == null ? '' : String(fila[i]);
          const celda = doc.splitTextToSize(valor, anchoCol - 4)[0] || '';
          doc.text(celda, margen + i * anchoCol, y);
        });
        y += interlineado;
      }
    }
  }

  // --- Firma estampada (PNG) ---
  if (firma && typeof firma === 'string' && firma.startsWith('data:image/png')) {
    const anchoFirma = 180;
    const altoFirma = 80;
    y += 20;
    asegurarEspacio(altoFirma + 20);
    escribirTexto('Firma:', { size: 10, style: 'bold', interlineado: 14 });
    try {
      doc.addImage(firma, 'PNG', margen, y, anchoFirma, altoFirma);
      y += altoFirma + 10;
    } catch (e) {
      // Si el dataURL no es una imagen valida, no se interrumpe la descarga.
      escribirTexto('(No se pudo estampar la firma)', { size: 9, style: 'normal' });
    }
  }

  doc.save(`${sanearNombre(nombre)}.pdf`);
};

// -------------------------------------------------------------------------
// generarActaAceptacion: compone el Markdown del "Acta de Aceptacion de Riesgo"
// y dispara el PDF con la firma estampada.
//
// payload (shape devuelto por el backend en POST/GET de /api/aceptaciones):
//   empresa    { nombre_empresa }
//   cve        { cve_id|id, severidad, cvss, descripcion }
//   activo     { nombre|activo_nombre, codigo|codigo_activo, ip|direccion_ip }
//   riesgo     { clasificacion, puntaje }
//   aceptante  { nombre_completo, correo }
//   aceptacion { justificacion, fecha_aceptacion, fecha_revision }
//   firma      dataURL PNG (eco del request o blob->dataURL en re-descarga)
//
// Devuelve el Markdown generado (util para descargarMarkdown o para test).
// -------------------------------------------------------------------------
export const generarActaAceptacion = (payload = {}) => {
  const empresa = payload.empresa || {};
  const cve = payload.cve || {};
  const activo = payload.activo || {};
  const riesgo = payload.riesgo || {};
  const aceptante = payload.aceptante || {};
  const aceptacion = payload.aceptacion || {};
  const firma = payload.firma;

  const nombreEmpresa = empresa.nombre_empresa || 'Empresa';
  const cveId = cve.cve_id || cve.id || 'N/D';
  const severidad = cve.severidad || 'N/D';
  const cvss = cve.cvss != null ? cve.cvss : 'N/D';
  const descripcionCve = cve.descripcion || 'Sin descripcion disponible.';

  const activoNombre = activo.nombre || activo.activo_nombre || 'N/D';
  const activoCodigo = activo.codigo || activo.codigo_activo || 'N/D';
  const activoIp = activo.ip || activo.direccion_ip || 'N/D';

  const clasificacion = riesgo.clasificacion || 'N/D';
  const puntaje = riesgo.puntaje != null ? riesgo.puntaje : 'N/D';

  const aceptanteNombre = aceptante.nombre_completo || 'N/D';
  const aceptanteCorreo = aceptante.correo || 'N/D';

  const justificacion = aceptacion.justificacion || 'N/D';
  const fmtFecha = (f) => {
    if (!f) return 'N/D';
    try {
      return new Date(f).toLocaleDateString('es-CO');
    } catch (e) {
      return String(f);
    }
  };
  const fechaAceptacion = fmtFecha(aceptacion.fecha_aceptacion);
  const fechaRevision = fmtFecha(aceptacion.fecha_revision);
  const fechaGeneracion = new Date().toLocaleString('es-CO');

  // --- Markdown del acta ---
  const md = `# Acta de Aceptacion de Riesgo

**Empresa:** ${nombreEmpresa}
**Fecha de generacion:** ${fechaGeneracion}

## Vulnerabilidad
- **CVE:** ${cveId}
- **Severidad:** ${severidad}
- **CVSS:** ${cvss}
- **Descripcion:** ${descripcionCve}

## Activo afectado
- **Nombre:** ${activoNombre}
- **Codigo:** ${activoCodigo}
- **IP:** ${activoIp}

## Riesgo
- **Clasificacion:** ${clasificacion}
- **Puntaje:** ${puntaje}

## Justificacion de la aceptacion
${justificacion}

## Aceptante
- **Nombre:** ${aceptanteNombre}
- **Correo:** ${aceptanteCorreo}
- **Fecha de aceptacion:** ${fechaAceptacion}
- **Vigente hasta (fecha de revision):** ${fechaRevision}
`;

  // --- PDF del acta (estructura para descargarPdf) con la firma estampada ---
  const nombreArchivo = `acta_aceptacion_${cveId}`;
  descargarPdf(nombreArchivo, {
    titulo: 'Acta de Aceptacion de Riesgo',
    empresa: nombreEmpresa,
    fecha: `Fecha de generacion: ${fechaGeneracion}`,
    secciones: [
      {
        encabezado: 'Vulnerabilidad',
        parrafos: [
          `CVE: ${cveId}`,
          `Severidad: ${severidad}`,
          `CVSS: ${cvss}`,
          `Descripcion: ${descripcionCve}`
        ]
      },
      {
        encabezado: 'Activo afectado',
        parrafos: [
          `Nombre: ${activoNombre}`,
          `Codigo: ${activoCodigo}`,
          `IP: ${activoIp}`
        ]
      },
      {
        encabezado: 'Riesgo',
        parrafos: [
          `Clasificacion: ${clasificacion}`,
          `Puntaje: ${puntaje}`
        ]
      },
      {
        encabezado: 'Justificacion de la aceptacion',
        parrafos: [justificacion]
      },
      {
        encabezado: 'Aceptante',
        parrafos: [
          `Nombre: ${aceptanteNombre}`,
          `Correo: ${aceptanteCorreo}`,
          `Fecha de aceptacion: ${fechaAceptacion}`,
          `Vigente hasta (fecha de revision): ${fechaRevision}`
        ]
      }
    ],
    firma
  });

  return md;
};

export default {
  sanearNombre,
  descargarArchivo,
  descargarMarkdown,
  descargarPdf,
  generarActaAceptacion
};
