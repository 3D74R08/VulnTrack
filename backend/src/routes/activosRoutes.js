const express = require('express');
const { crearActivo, obtenerActivos, actualizarActivo, eliminarActivo } = require('../controllers/activosController');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Middleware a nivel de router: TODAS las rutas de activos requieren un JWT válido
router.use(verificarToken);

// Definición de los endpoints CRUD
router.post('/', crearActivo);
router.get('/', obtenerActivos);
router.put('/:id', actualizarActivo);
router.delete('/:id', eliminarActivo);

module.exports = router;
