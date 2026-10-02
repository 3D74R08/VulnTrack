const express = require('express');
const router = express.Router();
const controller = require('../controllers/usuariosController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

router.use(verificarToken);
// Todos pueden ver la lista de usuarios (para asignaciones), pero solo ADMIN puede modificar.
router.get('/', controller.obtenerUsuarios);
router.post('/', autorizarRoles('ADMINISTRADOR'), controller.crearUsuario);
router.put('/:id/rol', autorizarRoles('ADMINISTRADOR'), controller.actualizarRol);
router.delete('/:id', autorizarRoles('ADMINISTRADOR'), controller.eliminarUsuario);

module.exports = router;