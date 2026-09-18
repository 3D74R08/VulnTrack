const express = require('express');
const { crearActivo, obtenerActivos, actualizarActivo, eliminarActivo } = require('../controllers/activosController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Middleware a nivel de router: TODAS las rutas de activos requieren un JWT válido
router.use(verificarToken);

// Definición de los endpoints CRUD
router.post('/', autorizarRoles('ADMINISTRADOR', 'GESTOR_ACTIVOS'), crearActivo);
router.get('/', obtenerActivos);
router.put('/:id', autorizarRoles('ADMINISTRADOR', 'GESTOR_ACTIVOS'), actualizarActivo);
router.delete('/:id', autorizarRoles('ADMINISTRADOR', 'GESTOR_ACTIVOS'), eliminarActivo);

module.exports = router;
