const express = require('express');
const router = express.Router();
const controller = require('../controllers/riesgosController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.use(verificarToken);
router.post('/', controller.registrarRiesgo);
router.get('/', controller.obtenerRiesgos);

module.exports = router;