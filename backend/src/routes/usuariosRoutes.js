const express = require('express');
const router = express.Router();
const controller = require('../controllers/usuariosController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.use(verificarToken);
router.get('/', controller.obtenerUsuarios);
router.put('/:id/rol', controller.actualizarRol);
router.delete('/:id', controller.eliminarUsuario);

module.exports = router;