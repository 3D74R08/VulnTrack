const express = require('express');
const { registrar, login, configurarMFA, habilitarMFA } = require('../controllers/authController');
const { verificarToken } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/registro', registrar);
router.post('/login', login);

// Rutas protegidas (El usuario debe haber hecho login normal primero para configurarlo)
router.get('/mfa/configurar', verificarToken, configurarMFA);
router.post('/mfa/habilitar', verificarToken, habilitarMFA);

module.exports = router;
