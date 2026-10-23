const express = require('express');
const router = express.Router();
const { obtenerMetricas } = require('../controllers/dashboardController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

// Todas las rutas de dashboard están protegidas
router.use(verificarToken);

router.get('/metricas', autorizarRoles('VER_DASHBOARD'), obtenerMetricas);

module.exports = router;
