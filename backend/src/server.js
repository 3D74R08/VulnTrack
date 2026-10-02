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

const app = express();

// Swagger Documentation
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// 1. Defensas perimetrales
app.use(helmet()); // Oculta Express y configura cabeceras anti-XSS/Clickjacking
app.use(cors()); // Permite peticiones del Frontend desde cualquier puerto local
app.use(express.json({ limit: '10kb' })); // Previene ataques DoS por Payload gigante

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

// Manejador de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ error: "Endpoint no encontrado o método no permitido." });
});

const startSLAWorker = require('./workers/slaWorker');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[INFO] API Core levantada en puerto ${PORT}`);
    startSLAWorker();
});
