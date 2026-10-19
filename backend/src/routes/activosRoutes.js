const express = require('express');
const { crearActivo, obtenerActivos, obtenerActivoPorId, actualizarActivo, eliminarActivo } = require('../controllers/activosController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Middleware a nivel de router: TODAS las rutas de activos requieren un JWT válido
router.use(verificarToken);

// Definición de los endpoints CRUD
router.post('/', autorizarRoles('ADMINISTRADOR', 'GESTOR_ACTIVOS'), crearActivo);
router.get('/', obtenerActivos);
// Detalle de un activo por id (lectura abierta a cualquier rol autenticado, igual que GET '/').
// Faltaba registrarla aunque el controlador exporta obtenerActivoPorId (mismo patrón que el bug de hallazgos).
router.get('/:id', obtenerActivoPorId);
router.put('/:id', autorizarRoles('ADMINISTRADOR', 'GESTOR_ACTIVOS'), actualizarActivo);
router.delete('/:id', autorizarRoles('ADMINISTRADOR', 'GESTOR_ACTIVOS'), eliminarActivo);

module.exports = router;
