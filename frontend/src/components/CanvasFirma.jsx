import React, { useRef, useState, useEffect } from 'react';

// CanvasFirma: lienzo HTML5 nativo para capturar la firma manuscrita del aceptante.
//
// - Soporta mouse (mousedown/mousemove/mouseup) y táctil (touchstart/touchmove/touchend).
// - Estado interno `firmado`: arranca en false y pasa a true en el PRIMER trazo real
//   (primer movimiento con el puntero abajo), y vuelve a false al pulsar "Limpiar".
//   Esto evita aceptar un canvas en blanco (un PNG transparente sí sería "válido" por
//   formato, pero sin trazo real no debe habilitarse el envío).
// - El dataURL (canvas.toDataURL('image/png')) SOLO se emite al padre cuando firmado===true.
//
// Props:
//   onFirmaChange(firmado: boolean, dataUrl: string|null)  callback al padre.
export default function CanvasFirma({ onFirmaChange }) {
  const canvasRef = useRef(null);
  const dibujandoRef = useRef(false);   // puntero abajo (no implica trazo todavía)
  const [firmado, setFirmado] = useState(false);

  // Fondo blanco al montar: así el PNG no sale transparente y la firma se ve en el acta.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }, []);

  // Traduce coordenadas de puntero/táctil a coordenadas del canvas.
  const obtenerPunto = (evento) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const fuente = evento.touches && evento.touches.length > 0 ? evento.touches[0] : evento;
    const escalaX = canvas.width / rect.width;
    const escalaY = canvas.height / rect.height;
    return {
      x: (fuente.clientX - rect.left) * escalaX,
      y: (fuente.clientY - rect.top) * escalaY
    };
  };

  const iniciarTrazo = (evento) => {
    evento.preventDefault();
    dibujandoRef.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = obtenerPunto(evento);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const moverTrazo = (evento) => {
    if (!dibujandoRef.current) return;
    evento.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = obtenerPunto(evento);
    ctx.lineTo(x, y);
    ctx.stroke();
    // Primer trazo real: marca firmado y emite el dataURL al padre.
    if (!firmado) {
      setFirmado(true);
      if (onFirmaChange) onFirmaChange(true, canvasRef.current.toDataURL('image/png'));
    } else if (onFirmaChange) {
      onFirmaChange(true, canvasRef.current.toDataURL('image/png'));
    }
  };

  const terminarTrazo = () => {
    if (!dibujandoRef.current) return;
    dibujandoRef.current = false;
    // Emite el dataURL final tras levantar el puntero (si hubo trazo).
    if (firmado && onFirmaChange) {
      onFirmaChange(true, canvasRef.current.toDataURL('image/png'));
    }
  };

  const limpiar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    dibujandoRef.current = false;
    setFirmado(false);
    if (onFirmaChange) onFirmaChange(false, null);
  };

  return (
    <div>
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-40 touch-none cursor-crosshair"
          onMouseDown={iniciarTrazo}
          onMouseMove={moverTrazo}
          onMouseUp={terminarTrazo}
          onMouseLeave={terminarTrazo}
          onTouchStart={iniciarTrazo}
          onTouchMove={moverTrazo}
          onTouchEnd={terminarTrazo}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs ${firmado ? 'text-emerald-600' : 'text-gray-400'}`}>
          {firmado ? 'Firma capturada.' : 'Dibuje su firma en el recuadro.'}
        </span>
        <button
          type="button"
          onClick={limpiar}
          className="text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}
