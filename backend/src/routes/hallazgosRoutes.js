const express = require('express');
const router = express.Router();
const controller = require('../controllers/hallazgosController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

router.use(verificarToken);
// Solo Administrador y Auditor pueden registrar o eliminar hallazgos
router.post('/', autorizarRoles('ADMINISTRADOR', 'AUDITOR'), controller.crearHallazgo);
router.delete('/:id', autorizarRoles('ADMINISTRADOR', 'AUDITOR'), controller.eliminarHallazgo);
// Todos pueden leer hallazgos y consultar NVD
router.get('/', controller.obtenerHallazgos);
router.get('/nvd/:cve', controller.consultarNVD);
// Detalle completo (trazabilidad): riesgo, planes e historial de una vulnerabilidad.
// IMPORTANTE: debe ir ANTES de cualquier otra ruta '/:id/...' pero el orden con '/nvd/:cve'
// es seguro porque 'nvd' no es un UUID. Esta ruta faltaba y por eso el detalle daba 404.
router.get('/:id', controller.obtenerHallazgoPorId);
// Cambiar estado de la vulnerabilidad (deja historial + auditoría)
router.patch('/:id/estado', autorizarRoles('ADMINISTRADOR', 'AUDITOR'), controller.cambiarEstado);
// Reintento manual de enriquecimiento NVD (recalcula riesgo y plan si aplica)
router.post('/:id/reenriquecer', autorizarRoles('ADMINISTRADOR', 'AUDITOR'), controller.reenriquecer);
// Editar campos editables de la vulnerabilidad (observaciones, fuente, fecha)
router.patch('/:id', autorizarRoles('ADMINISTRADOR', 'AUDITOR'), controller.actualizarHallazgo);

module.exports = router;