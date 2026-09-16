# Etapa 1: Construcción (Compilación de React/Vite futura)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
# Aquí irá el COPY del código fuente y el comando 'npm run build'

# Etapa 2: Servidor de Producción Ligero
FROM nginx:alpine
# Eliminar contenido por defecto de Nginx por seguridad
RUN rm -rf /usr/share/nginx/html/*
# Aquí copiaremos los estáticos desde la Etapa 1
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
