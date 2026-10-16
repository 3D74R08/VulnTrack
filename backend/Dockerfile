FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --chown=node:node src ./src

# Crear el directorio de subidas (evidencias) con ownership del usuario no-root 'node'
# ANTES del cambio de usuario. Asi, al montar un volumen persistente en /app/uploads,
# el usuario 'node' tiene permisos de escritura y se evita el error EACCES al crear
# subcarpetas por empresa. No se vuelve a root: el hardening se mantiene.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]