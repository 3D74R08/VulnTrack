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
// DECISION DE DISENO: el informe corporativo (banda de encabezado, pie de
// pagina, tablas con zebra/bordes/badges, recuadro de firma) se implementa
// A MANO con jsPDF, SIN anadir la dependencia jspdf-autotable. jspdf@2.5.2 ya
// esta en package.json y expone todo lo necesario (rect, setFillColor,
// setTextColor, splitTextToSize, addImage, getNumberOfPages). Evitamos asi
// introducir una dependencia nueva solo para dibujar tablas.
//
// Identidad visual SecureHub (sobria): paleta teal.
//   brand-primary  #0fa3b1  (banda de encabezado, fila de encabezado de tabla)
//   brand-secondary #2a9d8f (acentos, borde del recuadro de firma)
//   brand-dark     #264653  (titulos de seccion, pie)
//
// API publica estable (consumida por FEAT-003, NO cambiar firmas):
//   sanearNombre(nombre)
//   descargarArchivo(nombre, contenido, mime)
//   descargarMarkdown(nombre, md)
//   descargarPdf(nombre, { titulo, empresa, fecha, secciones, firma })
//   generarActaAceptacion(payload)

import { jsPDF } from 'jspdf';

// -------------------------------------------------------------------------
// Paleta de marca SecureHub en componentes RGB (jsPDF trabaja con 0-255).
// -------------------------------------------------------------------------
const COLOR = {
  teal: [15, 163, 177],        // #0fa3b1 brand-primary
  tealOscuro: [42, 157, 143],  // #2a9d8f brand-secondary
  marca: [38, 70, 83],         // #264653 brand-dark
  blanco: [255, 255, 255],
  textoCuerpo: [51, 65, 85],   // slate-700
  textoTenue: [100, 116, 139], // slate-500
  zebra: [241, 245, 249],      // #f1f5f9 gris muy claro
  borde: [226, 232, 240],      // #e2e8f0 gris borde sutil
};

// Colores de badge de severidad (clave en MAYUSCULAS sin tildes).
const COLOR_SEVERIDAD = {
  CRITICA: [220, 38, 38],  // #dc2626 rojo
  ALTA: [234, 88, 12],     // #ea580c naranja
  MEDIA: [217, 119, 6],    // #d97706 ambar
  BAJA: [37, 99, 235],     // #2563eb azul
};

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
// Normaliza un texto de severidad a la clave de COLOR_SEVERIDAD.
// Acepta 'Critica', 'CRITICA', 'crítica', etc. Devuelve '' si no coincide.
// -------------------------------------------------------------------------
const claveSeveridad = (valor) => {
  const limpio = String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  return COLOR_SEVERIDAD[limpio] ? limpio : '';
};

// -------------------------------------------------------------------------
// construirDocumentoPdf: construye (SIN guardar) el documento jsPDF a partir
// de la estructura simple usada por los consumidores. Se expone internamente
// para poder verificar por efecto real con Node (ver scripts de verificacion)
// sin depender del DOM. descargarPdf la envuelve y llama a doc.save().
//
//   doc:
//     titulo    string   titulo principal del documento.
//     empresa   string   (opcional) linea de empresa (va en la banda superior).
//     fecha     string   (opcional) linea de fecha/metadato (va en la banda).
//     secciones [{ encabezado, parrafos?:[], tabla?:{ columnas:[], filas:[[]] } }]
//     firma     string   (opcional) dataURL PNG para estampar al final.
//
// Devuelve la instancia jsPDF ya compuesta (encabezado + pie en cada pagina).
// -------------------------------------------------------------------------
const construirDocumentoPdf = ({ titulo, empresa, fecha, secciones = [], firma } = {}) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const margen = 48;
  const anchoUtil = anchoPagina - margen * 2;

  const altoBanda = 56;   // alto de la banda teal de encabezado
  const altoPie = 34;     // alto reservado para el pie de pagina
  const topContenido = altoBanda + 24; // donde empieza el contenido bajo la banda
  const limiteInferior = altoPagina - altoPie - 12; // tope para el contenido

  let y = topContenido;

  const fijarRelleno = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const fijarTexto = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const fijarTrazo = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  // Asegura que queda espacio vertical; si no, abre pagina nueva y reposiciona
  // el cursor bajo la banda (la banda y el pie se pintan al final de todo).
  const asegurarEspacio = (alto) => {
    if (y + alto > limiteInferior) {
      doc.addPage();
      y = topContenido;
    }
  };

  // Escribe texto con ajuste de linea y salto de pagina por cada linea.
  const escribirTexto = (texto, { size = 10, style = 'normal', interlineado = 14, color = COLOR.textoCuerpo } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    fijarTexto(color);
    const lineas = doc.splitTextToSize(String(texto ?? ''), anchoUtil);
    for (const linea of lineas) {
      asegurarEspacio(interlineado);
      doc.text(linea, margen, y);
      y += interlineado;
    }
  };

  // -----------------------------------------------------------------------
  // dibujarTabla: renderizador propio (sin jspdf-autotable).
  //  - anchos de columna proporcionales al ancho util.
  //  - encabezado con fondo teal y texto blanco; se repite al saltar pagina.
  //  - filas con zebra (blanco / gris claro) y bordes sutiles.
  //  - texto multilinea por celda: la altura de fila es el maximo de lineas.
  //  - si una columna se llama 'Severidad', su celda pinta un badge coloreado.
  // -----------------------------------------------------------------------
  const dibujarTabla = (tabla) => {
    const columnas = tabla.columnas;
    const filas = tabla.filas || [];
    const numCols = columnas.length;
    const anchoCol = anchoUtil / numCols;
    const padX = 6;      // padding horizontal dentro de la celda
    const padY = 7;      // padding vertical dentro de la celda
    const interlineado = 12;
    const sizeCelda = 9;
    const anchoTextoCol = anchoCol - padX * 2;

    // Indice de la columna de severidad (si existe) para pintar el badge.
    const idxSeveridad = columnas.findIndex((c) =>
      String(c ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase() === 'severidad'
    );

    // Dibuja la fila de encabezado teal a la altura y actual.
    const dibujarEncabezado = () => {
      const alto = interlineado + padY * 2;
      asegurarEspacio(alto);
      fijarRelleno(COLOR.teal);
      doc.rect(margen, y, anchoUtil, alto, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(sizeCelda);
      fijarTexto(COLOR.blanco);
      columnas.forEach((col, i) => {
        const lineas = doc.splitTextToSize(String(col ?? ''), anchoTextoCol);
        doc.text(lineas[0] || '', margen + i * anchoCol + padX, y + padY + interlineado - 3);
      });
      // Separadores verticales sutiles del encabezado.
      fijarTrazo(COLOR.teal);
      y += alto;
    };

    dibujarEncabezado();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(sizeCelda);

    filas.forEach((fila, indiceFila) => {
      // Pre-calcula las lineas de cada celda y la altura de la fila.
      const celdas = columnas.map((_, i) => {
        const valor = fila[i] == null ? '' : String(fila[i]);
        return doc.splitTextToSize(valor, anchoTextoCol);
      });
      const maxLineas = celdas.reduce((m, l) => Math.max(m, l.length), 1);
      const altoFila = maxLineas * interlineado + padY * 2;

      // Si no cabe la fila, salto de pagina y repito el encabezado.
      if (y + altoFila > limiteInferior) {
        doc.addPage();
        y = topContenido;
        dibujarEncabezado();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(sizeCelda);
      }

      // Fondo zebra (las filas pares llevan gris claro).
      if (indiceFila % 2 === 1) {
        fijarRelleno(COLOR.zebra);
        doc.rect(margen, y, anchoUtil, altoFila, 'F');
      }

      // Borde sutil de la fila y separadores de columna.
      fijarTrazo(COLOR.borde);
      doc.setLineWidth(0.5);
      doc.rect(margen, y, anchoUtil, altoFila, 'S');
      for (let i = 1; i < numCols; i++) {
        doc.line(margen + i * anchoCol, y, margen + i * anchoCol, y + altoFila);
      }

      // Contenido de cada celda.
      celdas.forEach((lineas, i) => {
        const xCelda = margen + i * anchoCol;
        const baseTexto = y + padY + interlineado - 3;

        if (i === idxSeveridad && lineas.length) {
          // Badge de severidad coloreado por valor.
          const etiqueta = String(fila[i] ?? '');
          const clave = claveSeveridad(etiqueta);
          const colorBadge = clave ? COLOR_SEVERIDAD[clave] : COLOR.textoTenue;
          doc.setFont('helvetica', 'bold');
          const anchoTexto = doc.getTextWidth(etiqueta);
          const padBadge = 5;
          const altoBadge = interlineado + 2;
          const anchoBadge = Math.min(anchoTexto + padBadge * 2, anchoTextoCol);
          const yBadge = y + (altoFila - altoBadge) / 2;
          fijarRelleno(colorBadge);
          doc.roundedRect(xCelda + padX, yBadge, anchoBadge, altoBadge, 3, 3, 'F');
          fijarTexto(COLOR.blanco);
          doc.text(etiqueta, xCelda + padX + padBadge, yBadge + altoBadge - 4, { maxWidth: anchoTextoCol - padBadge * 2 });
          doc.setFont('helvetica', 'normal');
          fijarTexto(COLOR.textoCuerpo);
        } else {
          fijarTexto(COLOR.textoCuerpo);
          lineas.forEach((linea, j) => {
            doc.text(linea, xCelda + padX, baseTexto + j * interlineado);
          });
        }
      });

      y += altoFila;
    });

    y += 6;
  };

  // --- Titulo bajo la banda ---
  escribirTexto(titulo || 'Documento', { size: 20, style: 'bold', interlineado: 26, color: COLOR.marca });
  y += 4;

  // --- Secciones ---
  for (const seccion of secciones) {
    if (!seccion) continue;
    y += 10;
    if (seccion.encabezado) {
      escribirTexto(seccion.encabezado, { size: 13, style: 'bold', interlineado: 18, color: COLOR.marca });
      // Subrayado fino bajo el titulo de seccion.
      asegurarEspacio(6);
      fijarTrazo(COLOR.tealOscuro);
      doc.setLineWidth(1);
      doc.line(margen, y - 8, margen + 60, y - 8);
      y += 4;
    }

    // Parrafos
    for (const parrafo of seccion.parrafos || []) {
      escribirTexto(parrafo, { size: 10, style: 'normal', interlineado: 14 });
    }

    // Tabla (columnas + filas) con renderizador propio.
    const tabla = seccion.tabla;
    if (tabla && Array.isArray(tabla.columnas) && tabla.columnas.length > 0) {
      y += 4;
      dibujarTabla(tabla);
    }
  }

  // --- Firma estampada (PNG) ---
  // Para el acta se usa el recuadro enmarcado de dibujarRecuadroFirma; aqui se
  // mantiene un estampado simple por compatibilidad cuando se pasa firma a un
  // documento generico que no sea el acta.
  if (firma && typeof firma === 'string' && firma.startsWith('data:image/png')) {
    const anchoFirma = 180;
    const altoFirma = 80;
    y += 20;
    asegurarEspacio(altoFirma + 20);
    escribirTexto('Firma:', { size: 10, style: 'bold', interlineado: 16, color: COLOR.marca });
    try {
      doc.addImage(firma, 'PNG', margen, y, anchoFirma, altoFirma);
      y += altoFirma + 10;
    } catch (e) {
      // Si el dataURL no es una imagen valida, no se interrumpe la descarga.
      escribirTexto('(No se pudo estampar la firma)', { size: 9, style: 'normal', color: COLOR.textoTenue });
    }
  }

  // --- Banda de encabezado + pie en CADA pagina (se pintan al final) ---
  pintarCromosEnTodasLasPaginas(doc, {
    anchoPagina,
    altoPagina,
    margen,
    altoBanda,
    altoPie,
    empresa,
    fecha,
  });

  return doc;
};

// -------------------------------------------------------------------------
// pintarCromosEnTodasLasPaginas: recorre todas las paginas del doc y pinta la
// banda teal de encabezado ('SecureHub' + empresa + fecha) y el pie de pagina
// ('Pagina X de Y' + nota de confidencialidad). Se hace al final porque solo
// entonces se conoce el numero total de paginas.
// -------------------------------------------------------------------------
const pintarCromosEnTodasLasPaginas = (doc, opciones) => {
  const { anchoPagina, altoPagina, margen, altoBanda, altoPie, empresa, fecha } = opciones;
  const total = doc.getNumberOfPages();

  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);

    // Banda teal superior.
    doc.setFillColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
    doc.rect(0, 0, anchoPagina, altoBanda, 'F');

    // Marca "SecureHub" a la izquierda.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(COLOR.blanco[0], COLOR.blanco[1], COLOR.blanco[2]);
    doc.text('SecureHub', margen, altoBanda / 2 + 2);

    // Empresa y fecha a la derecha (alineadas a la derecha).
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const xDerecha = anchoPagina - margen;
    if (empresa) {
      doc.text(String(empresa), xDerecha, altoBanda / 2 - 3, { align: 'right' });
    }
    if (fecha) {
      doc.text(String(fecha), xDerecha, altoBanda / 2 + 11, { align: 'right' });
    }

    // Pie: linea separadora + nota de confidencialidad + numero de pagina.
    const yPie = altoPagina - altoPie + 12;
    doc.setDrawColor(COLOR.borde[0], COLOR.borde[1], COLOR.borde[2]);
    doc.setLineWidth(0.5);
    doc.line(margen, yPie - 8, anchoPagina - margen, yPie - 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(COLOR.textoTenue[0], COLOR.textoTenue[1], COLOR.textoTenue[2]);
    doc.text('Documento confidencial - SecureHub', margen, yPie);
    doc.text(`Pagina ${pagina} de ${total}`, anchoPagina - margen, yPie, { align: 'right' });
  }
};

// -------------------------------------------------------------------------
// descargarPdf: compone el documento y dispara la descarga (.pdf).
// Mantiene la firma publica intacta (nombre + objeto de opciones).
// -------------------------------------------------------------------------
export const descargarPdf = (nombre, opciones = {}) => {
  const doc = construirDocumentoPdf(opciones);
  doc.save(`${sanearNombre(nombre)}.pdf`);
};

// -------------------------------------------------------------------------
// dibujarRecuadroFirma: en el acta, pinta un recuadro enmarcado legible de
// ~160x60 mm (convertido a pt: 1mm = 2.8346 pt => ~453x170 pt) con la etiqueta
// 'Firma del aceptante' encima; estampa la firma PNG escalada proporcionalmente
// dentro del recuadro y, debajo, el nombre del aceptante y la fecha. Si la firma
// es null/invalida, deja el recuadro vacio con la etiqueta (try/catch).
// -------------------------------------------------------------------------
const dibujarRecuadroFirma = (doc, { firma, nombreAceptante, fechaAceptacion, contexto }) => {
  const { anchoUtil, margen, topContenido, altoPagina, altoPie } = contexto;
  const MM = 2.8346; // puntos por milimetro
  const anchoCaja = Math.min(160 * MM, anchoUtil); // ~453 pt, acotado al ancho util
  const altoCaja = 60 * MM;                        // ~170 pt
  const limiteInferior = altoPagina - altoPie - 12;

  let y = contexto.y;

  // Reserva para etiqueta + recuadro + pie de datos; salta de pagina si no cabe.
  const altoTotal = 18 + altoCaja + 34;
  if (y + altoTotal > limiteInferior) {
    doc.addPage();
    y = topContenido;
  }

  // Etiqueta encima del recuadro.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(COLOR.marca[0], COLOR.marca[1], COLOR.marca[2]);
  doc.text('Firma del aceptante', margen, y);
  y += 10;

  // Recuadro enmarcado.
  doc.setDrawColor(COLOR.tealOscuro[0], COLOR.tealOscuro[1], COLOR.tealOscuro[2]);
  doc.setLineWidth(1);
  doc.setFillColor(COLOR.blanco[0], COLOR.blanco[1], COLOR.blanco[2]);
  doc.roundedRect(margen, y, anchoCaja, altoCaja, 6, 6, 'FD');

  // Estampado de la firma escalada proporcionalmente dentro del recuadro.
  if (firma && typeof firma === 'string' && firma.startsWith('data:image/png')) {
    try {
      const padCaja = 12;
      const maxW = anchoCaja - padCaja * 2;
      const maxH = altoCaja - padCaja * 2;
      let w = maxW;
      let h = maxH;
      // Intenta respetar la relacion de aspecto real de la imagen.
      try {
        const props = doc.getImageProperties(firma);
        if (props && props.width && props.height) {
          const escala = Math.min(maxW / props.width, maxH / props.height);
          w = props.width * escala;
          h = props.height * escala;
        }
      } catch (e) {
        // Sin propiedades: usa el area completa con padding.
      }
      const xImg = margen + (anchoCaja - w) / 2;
      const yImg = y + (altoCaja - h) / 2;
      doc.addImage(firma, 'PNG', xImg, yImg, w, h);
    } catch (e) {
      // Firma invalida: el recuadro queda vacio, sin romper la descarga.
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(COLOR.textoTenue[0], COLOR.textoTenue[1], COLOR.textoTenue[2]);
      doc.text('(Firma no disponible)', margen + 12, y + altoCaja / 2);
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(COLOR.textoTenue[0], COLOR.textoTenue[1], COLOR.textoTenue[2]);
    doc.text('(Firma no disponible)', margen + 12, y + altoCaja / 2);
  }

  y += altoCaja + 16;

  // Nombre y fecha debajo del recuadro.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(COLOR.textoCuerpo[0], COLOR.textoCuerpo[1], COLOR.textoCuerpo[2]);
  doc.text(`Nombre: ${nombreAceptante || 'N/D'}`, margen, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha de aceptacion: ${fechaAceptacion || 'N/D'}`, margen, y);
  y += 14;

  contexto.y = y;
};

// -------------------------------------------------------------------------
// generarActaAceptacion: compone el Markdown del "Acta de Aceptacion de Riesgo"
// y dispara el PDF corporativo con el recuadro de firma enmarcado.
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

  // --- Markdown del acta (se mantiene igual: mismo contenido y retorno) ---
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

  // --- PDF del acta: se construye el cuerpo con las secciones y luego se
  // dibuja el recuadro de firma enmarcado; al final se pintan banda y pie. ---
  const nombreArchivo = `acta_aceptacion_${cveId}`;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const margen = 48;
  const anchoUtil = anchoPagina - margen * 2;
  const altoBanda = 56;
  const altoPie = 34;
  const topContenido = altoBanda + 24;
  const limiteInferior = altoPagina - altoPie - 12;

  const contexto = { y: topContenido, anchoUtil, margen, topContenido, altoPagina, altoPie };

  const escribirLinea = (texto, { size = 10, style = 'normal', interlineado = 14, color = COLOR.textoCuerpo } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lineas = doc.splitTextToSize(String(texto ?? ''), anchoUtil);
    for (const linea of lineas) {
      if (contexto.y + interlineado > limiteInferior) {
        doc.addPage();
        contexto.y = topContenido;
      }
      doc.text(linea, margen, contexto.y);
      contexto.y += interlineado;
    }
  };

  const tituloSeccion = (texto) => {
    contexto.y += 10;
    escribirLinea(texto, { size: 13, style: 'bold', interlineado: 18, color: COLOR.marca });
    doc.setDrawColor(COLOR.tealOscuro[0], COLOR.tealOscuro[1], COLOR.tealOscuro[2]);
    doc.setLineWidth(1);
    doc.line(margen, contexto.y - 8, margen + 60, contexto.y - 8);
    contexto.y += 4;
  };

  // Titulo principal.
  escribirLinea('Acta de Aceptacion de Riesgo', { size: 20, style: 'bold', interlineado: 26, color: COLOR.marca });
  contexto.y += 4;

  tituloSeccion('Vulnerabilidad');
  escribirLinea(`CVE: ${cveId}`);
  escribirLinea(`Severidad: ${severidad}`);
  escribirLinea(`CVSS: ${cvss}`);
  escribirLinea(`Descripcion: ${descripcionCve}`);

  tituloSeccion('Activo afectado');
  escribirLinea(`Nombre: ${activoNombre}`);
  escribirLinea(`Codigo: ${activoCodigo}`);
  escribirLinea(`IP: ${activoIp}`);

  tituloSeccion('Riesgo');
  escribirLinea(`Clasificacion: ${clasificacion}`);
  escribirLinea(`Puntaje: ${puntaje}`);

  tituloSeccion('Justificacion de la aceptacion');
  escribirLinea(justificacion);

  tituloSeccion('Aceptante');
  escribirLinea(`Nombre: ${aceptanteNombre}`);
  escribirLinea(`Correo: ${aceptanteCorreo}`);
  escribirLinea(`Fecha de aceptacion: ${fechaAceptacion}`);
  escribirLinea(`Vigente hasta (fecha de revision): ${fechaRevision}`);

  // Recuadro de firma enmarcado.
  contexto.y += 18;
  dibujarRecuadroFirma(doc, {
    firma,
    nombreAceptante: aceptanteNombre,
    fechaAceptacion,
    contexto,
  });

  // Banda + pie en todas las paginas.
  pintarCromosEnTodasLasPaginas(doc, {
    anchoPagina,
    altoPagina,
    margen,
    altoBanda,
    altoPie,
    empresa: nombreEmpresa,
    fecha: `Fecha de generacion: ${fechaGeneracion}`,
  });

  doc.save(`${sanearNombre(nombreArchivo)}.pdf`);

  return md;
};

export default {
  sanearNombre,
  descargarArchivo,
  descargarMarkdown,
  descargarPdf,
  generarActaAceptacion
};
