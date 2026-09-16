const express = require('express');
const router = express.Router();
const controller = require('../controllers/hallazgosController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.use(verificarToken);
router.post('/', controller.crearHallazgo);
router.get('/', controller.obtenerHallazgos);
router.get('/nvd/:cve', controller.consultarNVD);
router.delete('/:id', controller.eliminarHallazgo);

module.exports = router;