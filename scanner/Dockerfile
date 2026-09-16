FROM node:20-alpine

# 1. Actualizar el gestor de paquetes para parchar vulnerabilidades de la imagen base
RUN apk update && apk upgrade

# 2. Definir directorio de trabajo
WORKDIR /app

# 3. Copiar configuración e instalar dependencias (actualmente vacío)
COPY package.json ./
RUN npm install

# 4. Cambiar al usuario sin privilegios incluido en la imagen oficial
USER node

# 5. Comando temporal para mantener el contenedor vivo sin lógica de negocio
CMD ["tail", "-f", "/dev/null"]
