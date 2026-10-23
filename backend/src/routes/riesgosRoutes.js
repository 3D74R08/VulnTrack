const express = require('express');
const router = express.Router();
const controller = require('../controllers/riesgosController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

router.use(verificarToken);
router.post('/', autorizarRoles('GESTIONAR_RIESGOS'), controller.registrarRiesgo);
router.get('/', autorizarRoles('VER_RIESGOS'), controller.obtenerRiesgos);

module.exports = router;
