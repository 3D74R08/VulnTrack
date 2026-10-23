const express = require('express');
const { crearActivo, obtenerActivos, obtenerActivoPorId, actualizarActivo, eliminarActivo } = require('../controllers/activosController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Middleware a nivel de router: TODAS las rutas de activos requieren un JWT válido
router.use(verificarToken);

// Definición de los endpoints CRUD
router.post('/', autorizarRoles('CREAR_ACTIVOS'), crearActivo);
router.get('/', autorizarRoles('VER_ACTIVOS'), obtenerActivos);
// Detalle de un activo por id (lectura abierta a cualquier rol autenticado, igual que GET '/').
// Faltaba registrarla aunque el controlador exporta obtenerActivoPorId (mismo patrón que el bug de hallazgos).
router.get('/:id', autorizarRoles('VER_ACTIVOS'), obtenerActivoPorId);
router.put('/:id', autorizarRoles('CREAR_ACTIVOS'), actualizarActivo);
router.delete('/:id', autorizarRoles('CREAR_ACTIVOS'), eliminarActivo);

module.exports = router;
