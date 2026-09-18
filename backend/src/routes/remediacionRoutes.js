const express = require('express');
const router = express.Router();
const controller = require('../controllers/remediacionController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

router.use(verificarToken);
router.post('/', autorizarRoles('ADMINISTRADOR', 'ANALISTA_SEGURIDAD', 'AUDITOR'), controller.crearPlan);
router.get('/', controller.obtenerPlanes);

module.exports = router;