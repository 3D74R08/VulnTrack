const express = require('express');
const router = express.Router();
const controller = require('../controllers/usuariosController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

router.use(verificarToken);
router.get('/', autorizarRoles('VER_USUARIOS', 'CREAR_USUARIOS', 'GESTIONAR_REMEDIACION'), controller.obtenerUsuarios);
router.post('/', autorizarRoles('CREAR_USUARIOS'), controller.crearUsuario);
router.put('/:id/rol', autorizarRoles('CREAR_USUARIOS'), controller.actualizarRol);
router.delete('/:id', autorizarRoles('CREAR_USUARIOS'), controller.eliminarUsuario);

module.exports = router;
