const express = require('express');
const router = express.Router();
const controller = require('../controllers/auditoriaController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

router.use(verificarToken);
router.get('/', autorizarRoles('VER_AUDITORIA'), controller.obtenerEventos);
router.post('/', autorizarRoles('VER_AUDITORIA'), controller.registrarEvento);

module.exports = router;
