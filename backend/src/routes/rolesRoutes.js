const express = require('express');
const router = express.Router();
const controller = require('../controllers/rolesController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

router.use(verificarToken);
router.get('/', autorizarRoles('EDITAR_ROLES', 'VER_USUARIOS', 'CREAR_USUARIOS'), controller.obtenerRoles);
router.post('/', autorizarRoles('EDITAR_ROLES'), controller.crearRol);
router.put('/:id', autorizarRoles('EDITAR_ROLES'), controller.actualizarRol);
router.delete('/:id', autorizarRoles('EDITAR_ROLES'), controller.eliminarRol);

module.exports = router;
