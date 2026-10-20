// Limita operaciones que leen o escriben archivos para reducir abuso de recursos.
const VENTANA_MS = 60 * 1000;
const MAXIMO_SOLICITUDES = 30;
const MAXIMO_CLIENTES = 10000;
const solicitudesPorIp = new Map();

const limitarAccesoArchivos = (req, res, next) => {
    const ahora = Date.now();

    // Descarta ventanas vencidas para mantener acotada la memoria del proceso.
    for (const [ip, registro] of solicitudesPorIp) {
        if (registro.vence <= ahora) solicitudesPorIp.delete(ip);
    }

    const clave = req.ip || req.socket.remoteAddress || 'desconocida';
    let registro = solicitudesPorIp.get(clave);

    if (!registro) {
        if (solicitudesPorIp.size >= MAXIMO_CLIENTES) {
            return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });
        }
        registro = { cantidad: 0, vence: ahora + VENTANA_MS };
        solicitudesPorIp.set(clave, registro);
    }

    registro.cantidad += 1;
    if (registro.cantidad > MAXIMO_SOLICITUDES) {
        return res.status(429)
            .set('Retry-After', String(Math.ceil((registro.vence - ahora) / 1000)))
            .json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });
    }

    return next();
};

module.exports = { limitarAccesoArchivos };
