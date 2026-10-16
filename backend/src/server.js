const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

// importacion de rutas auth y negocio
const authRoutes = require('./routes/authRoutes');
const activosRoutes = require('./routes/activosRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const hallazgosRoutes = require('./routes/hallazgosRoutes');
const riesgosRoutes = require('./routes/riesgosRoutes');
const remediacionRoutes = require('./routes/remediacionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');
const rolesRoutes = require('./routes/rolesRoutes');
const importacionRoutes = require('./routes/importacionRoutes');
const notificacionesRoutes = require('./routes/notificacionesRoutes');

// API stateless: la autenticación protegida utiliza JWT en Authorization: Bearer,
// no cookies de sesión enviadas automáticamente por el navegador.
// Las peticiones JSON entre orígenes requieren preflight y CORS limita los orígenes.
// nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage -- CSRF middleware basado en cookies no aplica a este esquema Bearer; reevaluar si se introducen cookies de autenticación.
const app = express();

// Confianza en el primer proxy (frontend) para que req.ip refleje la IP real del cliente.
app.set('trust proxy', 1);

// Lista blanca de origenes permitidos por CORS leida de CORS_ORIGINS (CSV).
// Fallback de desarrollo si la variable no esta definida.
const origenesPermitidos = (process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost', 'http://localhost:80']);

const esProduccion = process.env.NODE_ENV === 'production';

// En desarrollo aceptamos cualquier origen de localhost o de una IP de LAN privada
// (10.x, 172.16-31.x, 192.168.x) en cualquier puerto, para no bloquear el dev server
// de Vite cuando se accede por la IP de la maquina. En produccion manda SOLO la lista blanca.
const RE_ORIGEN_DEV = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

const origenPermitido = (origin) => {
    // Peticiones sin Origin (curl, health checks, same-origin server-to-server) se permiten.
    if (!origin) return true;
    if (origenesPermitidos.includes(origin)) return true;
    if (!esProduccion && RE_ORIGEN_DEV.test(origin)) return true;
    return false;
};

// Swagger Documentation

// 1. Defensas perimetrales
app.disable('x-powered-by');

// Oculta Express y configura cabeceras anti-XSS/Clickjacking (hardening del companero).
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-origin' },
}));

// CORS restringido: lista blanca (CORS_ORIGINS) + localhost/LAN privada en desarrollo.
// Se conserva origenPermitido() del usuario para no romper el login por LAN en dev.
app.use(cors({
    origin: (origin, cb) => {
        if (origenPermitido(origin)) return cb(null, true);
        return cb(new Error('Origen no permitido por CORS'));
    },
    credentials: true,
}));

app.use(express.json({ limit: '10kb' }));

// Swagger Documentation
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

app.get('/api-docs.json', (req, res) => {
    res.json(swaggerDocument);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


// 2. Ruta de validación de infraestructura
app.get('/health', async (req, res) => {
    res.json({ status: 'OK', servicio: 'SecureHub API', version: '1.0.0' });
});

// rutas de negocio
app.use('/api/auth', authRoutes);
app.use('/api/activos', activosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/hallazgos', hallazgosRoutes);
app.use('/api/riesgos', riesgosRoutes);
app.use('/api/remediacion', remediacionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/importacion', importacionRoutes);
app.use('/api/notificaciones', notificacionesRoutes);

// Manejador de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ error: "Endpoint no encontrado o método no permitido." });
});

const startSLAWorker = require('./workers/slaWorker');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[INFO] API Core levantada en puerto ${PORT}`);

  if (process.env.DISABLE_BACKGROUND_WORKERS !== 'true') {
    startSLAWorker();
  } else {
    console.log('[INFO] Workers desactivados para el entorno de pruebas.');
  }
});