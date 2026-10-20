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
router.post('/', autorizarRoles('ADMINISTRADOR', 'ANALISTA_SEGURIDAD', 'AUDITOR'), controller.crearPlan);
router.get('/', controller.obtenerPlanes);
router.get('/:id', controller.obtenerPlanPorId);
router.put('/:id', autorizarRoles('ADMINISTRADOR', 'ANALISTA_SEGURIDAD', 'REMEDIADOR'), controller.actualizarPlan);
router.patch('/:id/estado', autorizarRoles('ADMINISTRADOR', 'ANALISTA_SEGURIDAD', 'REMEDIADOR'), controller.cambiarEstadoPlan);
router.patch('/:id/asignar', autorizarRoles('ADMINISTRADOR'), controller.asignarRemediador);
router.post('/:id/evidencias', limitarAccesoArchivos, autorizarRoles('ADMINISTRADOR', 'ANALISTA_SEGURIDAD', 'REMEDIADOR'), upload.single('archivo'), controller.agregarEvidencia);
router.get('/evidencia/:id_evidencia', limitarAccesoArchivos, controller.descargarEvidencia);
module.exports = router;
