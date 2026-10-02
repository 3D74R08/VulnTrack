const express = require('express');
const router = express.Router();
const controller = require('../controllers/rolesController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

router.use(verificarToken);
router.get('/', controller.obtenerRoles);
router.post('/', autorizarRoles('EDITAR_ROLES', 'ADMINISTRADOR'), controller.crearRol);
router.put('/:id', autorizarRoles('EDITAR_ROLES', 'ADMINISTRADOR'), controller.actualizarRol);
router.delete('/:id', autorizarRoles('EDITAR_ROLES', 'ADMINISTRADOR'), controller.eliminarRol);

module.exports = router;
