const express = require('express');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const controller = require('../controllers/remediacionController');
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
router.post('/', autorizarRoles('GESTIONAR_REMEDIACION'), controller.crearPlan);
router.get('/', autorizarRoles('VER_REMEDIACION'), controller.obtenerPlanes);
router.get('/evidencia/:id_evidencia', limitarAccesoArchivos, autorizarRoles('VER_REMEDIACION'), controller.descargarEvidencia);
router.get('/:id', autorizarRoles('VER_REMEDIACION'), controller.obtenerPlanPorId);
router.put('/:id', autorizarRoles('GESTIONAR_REMEDIACION'), controller.actualizarPlan);
router.patch('/:id/estado', autorizarRoles('GESTIONAR_REMEDIACION'), controller.cambiarEstadoPlan);
router.patch('/:id/asignar', autorizarRoles('ADMINISTRADOR'), controller.asignarRemediador);
router.post('/:id/evidencias', limitarAccesoArchivos, autorizarRoles('GESTIONAR_REMEDIACION'), upload.single('archivo'), controller.agregarEvidencia);
module.exports = router;
