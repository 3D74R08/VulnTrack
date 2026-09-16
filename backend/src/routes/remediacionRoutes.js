const express = require('express');
const router = express.Router();
const controller = require('../controllers/remediacionController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.use(verificarToken);
router.post('/', controller.crearPlan);
router.get('/', controller.obtenerPlanes);

module.exports = router;