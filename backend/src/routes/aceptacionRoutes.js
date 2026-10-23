const express = require('express');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();
const controller = require('../controllers/aceptacionController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

const limitarAccesoArchivos = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' }
});

router.use(verificarToken);
router.post('/', autorizarRoles('GESTIONAR_RIESGOS'), controller.aceptarRiesgo);
router.get('/:idHallazgo', autorizarRoles('VER_RIESGOS'), controller.consultarAceptacion);
// Descargar el PNG de la firma por id de aceptación (FIX 3: id_aceptacion, no id_hallazgo).
router.get('/:idAceptacion/firma', limitarAccesoArchivos, autorizarRoles('VER_RIESGOS'), controller.descargarFirma);

module.exports = router;
