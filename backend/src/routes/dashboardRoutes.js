const express = require('express');
const router = express.Router();
const { obtenerMetricas } = require('../controllers/dashboardController');
const { verificarToken } = require('../middlewares/authMiddleware');

// Todas las rutas de dashboard están protegidas
router.use(verificarToken);

router.get('/metricas', obtenerMetricas);

module.exports = router;
