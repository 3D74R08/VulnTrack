const express = require('express');
const router = express.Router();
const controller = require('../controllers/importacionController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { autorizarRoles } = require('../middlewares/roleMiddleware');
const multer = require('multer');

// Configuración de multer en memoria
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10 MB
});

router.use(verificarToken);

router.get('/plantilla', autorizarRoles('IMPORTAR_DATOS'), controller.descargarPlantilla);

router.post('/excel', autorizarRoles('IMPORTAR_DATOS'), upload.single('file'), controller.importar);

module.exports = router;
