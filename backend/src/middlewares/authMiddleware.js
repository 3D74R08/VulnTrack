const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    // Verificamos que el header exista y tenga el formato 'Bearer <token>'
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Acceso denegado. Token no proporcionado o formato incorrecto." });
    }

    const token = authHeader.split(' ')[1];
    
    try {
        // Decodificamos el token con nuestro secreto
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Inyectamos la información del usuario en la petición (id, id_empresa, rol)
        req.usuario = decoded; 
        
        next(); // Pasamos al siguiente controlador
    } catch (error) {
        return res.status(401).json({ error: "Token inválido o expirado." });
    }
};

module.exports = { verificarToken };
