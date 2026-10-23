const express = require('express');
const router = express.Router();
const controller = require('../controllers/hallazgosController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');

router.use(verificarToken);
// Solo Administrador y Auditor pueden registrar o eliminar hallazgos
router.post('/', autorizarRoles('CREAR_VULN'), controller.crearHallazgo);
router.delete('/:id', autorizarRoles('CREAR_VULN'), controller.eliminarHallazgo);
router.get('/', autorizarRoles('VER_VULN'), controller.obtenerHallazgos);
router.get('/nvd/:cve', autorizarRoles('VER_VULN'), controller.consultarNVD);
// Detalle completo (trazabilidad): riesgo, planes e historial de una vulnerabilidad.
// IMPORTANTE: debe ir ANTES de cualquier otra ruta '/:id/...' pero el orden con '/nvd/:cve'
// es seguro porque 'nvd' no es un UUID. Esta ruta faltaba y por eso el detalle daba 404.
router.get('/:id', autorizarRoles('VER_VULN'), controller.obtenerHallazgoPorId);
// Cambiar estado de la vulnerabilidad (deja historial + auditoría)
router.patch('/:id/estado', autorizarRoles('CREAR_VULN'), controller.cambiarEstado);
// Reintento manual de enriquecimiento NVD (recalcula riesgo y plan si aplica)
router.post('/:id/reenriquecer', autorizarRoles('CREAR_VULN'), controller.reenriquecer);
// Editar campos editables de la vulnerabilidad (observaciones, fuente, fecha)
router.patch('/:id', autorizarRoles('CREAR_VULN'), controller.actualizarHallazgo);

module.exports = router;
