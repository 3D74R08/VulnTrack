const express = require('express');
const router = express.Router();
const controller = require('../controllers/riesgosController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

router.use(verificarToken);
router.post('/', autorizarRoles('ADMINISTRADOR', 'ANALISTA_SEGURIDAD'), controller.registrarRiesgo);
router.get('/', controller.obtenerRiesgos);

module.exports = router;