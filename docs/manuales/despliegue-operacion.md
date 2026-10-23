# 4.4 Manual de Despliegue y Operación — SecureHub / VulnTrack

*Despliegue local desde cero mediante Docker Compose*

| Campo | Valor |
| --- | --- |
| **Proyecto** | SecureHub / VulnTrack |
| **Versión documental** | 1.0 — 20 de octubre de 2026 |
| **Licencia** | MIT (`LICENSE`) |
| **Estado** | Borrador técnico basado en archivos y evidencias compartidas; validar pendientes antes de producción |

---

## 1. Objetivo y alcance

Describir cómo preparar un equipo limpio con Windows y Docker Desktop, configurar variables de entorno, desplegar VulnTrack/SecureHub con contenedores, verificar el estado de los servicios y diagnosticar problemas comunes. Este documento se limita al despliegue local documentado; no equivale a una guía de producción endurecida.

---

## 2. Arquitectura desplegada

| Servicio | Función | Exposición / puerto observado en Compose |
| --- | --- | --- |
| `securehub-frontend` | SPA React compilada y servida por Nginx | `80 → 8080` |
| `securehub-api` | API Node.js/Express | `127.0.0.1:3000 → 3000` |
| `securehub-db` | PostgreSQL 18 | `5432` solo en red interna |
| `securehub-redis` | Redis 7 con autenticación | `6379` solo en red interna |
| `securehub-worker` | Procesos worker, SLA/NVD | Red interna |
| `securehub-scanner` | Escaneo del repositorio con Trivy | Red interna |
| `securehub-files` | Nginx para evidencias estáticas | Red interna |
| `prometheus` | Métricas y alertas | `9090` |
| `alertmanager` | Gestión de alertas | `9093` |
| `grafana` | Visualización de métricas | `3001 → 3000` |
| `loki` / `alloy` | Agregación y envío de logs | Loki interno; Alloy interno |

---

## 3. Requisitos previos

* Windows 10/11 y PowerShell; Git para Windows.
* Docker Desktop instalado y en ejecución con Docker Compose v2.
* Acceso al repositorio y conectividad para descargar imágenes.
* Memoria y almacenamiento suficientes para imágenes, volúmenes de PostgreSQL, caché de Trivy y métricas. La capacidad exacta no está fijada en los archivos revisados; definirla según el uso esperado.
* Puertos locales libres: `80`, `3000`, `3001`, `9090` y `9093`. El puerto `5173` solo se usa si Vite se ejecuta aparte.

```powershell
git --version
docker --version
docker compose version
```

---

## 4. Clonar y preparar el proyecto

```powershell
git clone https://github.com/3D74R08/VulnTrack.git
cd .\VulnTrack
```

Confirmar que el directorio actual contiene `docker-compose.yml`, `.env.example` y las carpetas `backend`, `frontend`, `base_datos`, `config`, `deploy`, `monitoring` y `scanner`.

---

## 5. Configurar variables de entorno

```powershell
Copy-Item .env.example .env
notepad .env
```

Configurar las variables requeridas en el archivo de ejemplo. Los nombres y valores por defecto pueden cambiar según la versión del repositorio; prevalecen el `.env.example` y `docker-compose.yml` de la versión que se despliega.

| Variable / grupo | Uso | Recomendación |
| --- | --- | --- |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Base y usuario administrativo de PostgreSQL | Valores locales únicos; no reutilizar credenciales de producción. |
| `DB_APP_PASSWORD` | Credencial de `app_user`, cuenta de menor privilegio | Generar una contraseña fuerte independiente. |
| `REDIS_PASSWORD` | Protección de Redis | Definir contraseña no vacía y no compartirla. |
| `JWT_SECRET` | Firma de tokens de autenticación | Secreto aleatorio largo; rotar si se expone. |
| `CORS_ORIGINS` | Lista de orígenes permitidos | Limitar a los orígenes usados; no permitir cualquier origen. |
| `DEMO_ADMIN_*` | Cuenta local de demostración | Activar solo para bootstrap de entorno local y desactivar después. |
| `NVD_API_KEY` | Consulta a NVD | Opcional según el uso y límites de la fuente. |
| `SMTP_*` | Notificaciones por correo | Configurar solo si se probará el envío de correo. |
| `SCANNER_INTERVAL_MS` | Intervalo del escáner | Usar un valor apropiado para pruebas locales. |

> **Protección:** No adjuntar `.env` a informes, capturas ni repositorios. Si se incluyó en un ZIP compartido o se sospecha exposición, rotar los secretos.

---

## 6. Validar la configuración

```powershell
docker compose config --quiet
```

Si el comando devuelve un error, corregir variables ausentes, sintaxis YAML o referencias a archivos antes de continuar. No seguir al despliegue hasta que la configuración sea válida.

---

## 7. Construir e iniciar el despliegue completo

```powershell
docker compose up -d --build
```

Docker descargará imágenes y construirá las imágenes propias de API, frontend, worker y scanner. La primera ejecución puede tardar por la descarga de capas. En la evidencia entregada, las imágenes se construyeron y varios servicios quedaron `Up` / `healthy`.

---

## 8. Verificar el despliegue

1. Consultar el estado de los servicios.
2. Revisar los logs de servicios que no aparezcan `healthy` o que reinicien.
3. Abrir la aplicación en el navegador.
4. Comprobar el endpoint de salud de la API.
5. Verificar que el inicio de sesión y una operación funcional de prueba trabajen correctamente.

```powershell
docker compose ps
docker compose logs --tail=100
docker compose logs --tail=100 securehub-api
docker compose logs --tail=100 securehub-db
```

| URL | Uso |
| --- | --- |
| `http://localhost/` | Frontend contenedorizado, puerto 80 |
| `http://localhost:3000/health` | Endpoint de salud de la API |
| `http://localhost:9090/` | Prometheus, si está habilitado |
| `http://localhost:9093/` | Alertmanager, si está habilitado |
| `http://localhost:3001/` | Grafana, si está habilitado |
| `http://localhost:5173/` | Frontend Vite, solo si se inicia manualmente |

---

## 9. Inicialización y persistencia de PostgreSQL

Compose monta scripts SQL en `/docker-entrypoint-initdb.d`. PostgreSQL ejecuta estos scripts únicamente cuando inicializa un volumen de datos vacío. El servicio `securehub-db-bootstrap` ejecuta tareas idempotentes de configuración/migración definidas en Compose, incluidas semillas de roles y migraciones seleccionadas.

> **Precaución:** No eliminar volúmenes ni restaurar respaldos sobre datos que deban conservarse. `docker compose down` conserva volúmenes por defecto; `docker compose down -v` puede eliminar datos persistentes.

---

## 10. Operación diaria

| Tarea | Comando |
| --- | --- |
| Ver estado | `docker compose ps` |
| Ver logs recientes | `docker compose logs --tail=100` |
| Seguir logs de API | `docker compose logs -f securehub-api` |
| Reiniciar un servicio | `docker compose restart securehub-api` |
| Detener contenedores | `docker compose stop` |
| Iniciar contenedores detenidos | `docker compose start` |
| Reconstruir tras cambios | `docker compose up -d --build` |
| Eliminar contenedores/red creada | `docker compose down` |

---

## 11. Copias de seguridad y restauración

El Compose declara un volumen de respaldo, pero la existencia de ese volumen por sí sola no demuestra que exista una política automatizada de copias. Antes de operar con datos importantes, definir frecuencia, retención, almacenamiento externo, cifrado y pruebas de restauración.

```powershell
docker compose exec -T securehub-db pg_dump -U <usuario_db> -d <nombre_db> -Fc > .\securehub-backup.dump
```

El ejemplo es una plantilla: sustituir los marcadores por las variables reales y guardar el archivo en una ubicación protegida fuera del repositorio. Validar el respaldo y la restauración en un entorno de prueba antes de confiar en él.

---

## 12. Solución de problemas

| Síntoma | Diagnóstico y acción |
| --- | --- |
| `docker compose config` falla | Revisar `.env`, nombres de variables y sintaxis del YAML. |
| Servicio no arranca | Ejecutar `docker compose ps` y `docker compose logs --tail=200 <servicio>`. |
| API no saludable | Comprobar `GET /health`, conectividad con PostgreSQL/Redis y variables de entorno. |
| Frontend no abre en `localhost` | Confirmar que `securehub-frontend` está activo y que el puerto `80` está libre. |
| Error de permisos en volúmenes | Revisar los servicios de inicialización de volúmenes y los logs asociados. |
| Cambios de esquema no aparecen | Recordar que `initdb.d` no se ejecuta de nuevo sobre un volumen inicializado; revisar las migraciones y el bootstrap. |
| Puerto ocupado | Identificar el proceso local o cambiar el mapeo de forma coordinada y documentada. |
| La importación de imágenes tarda | Esperar a que finalicen las descargas; revisar conectividad y espacio en disco. |

---

## 13. Seguridad operativa y limitaciones

* La configuración observada está orientada a ejecución local; no debe exponerse a Internet sin revisión de TLS, autenticación de consolas de monitoreo, firewall, secretos, backups y hardening.
* El puerto `80` publica el frontend en todas las interfaces por defecto; la API se limita a loopback `127.0.0.1:3000` en el Compose principal.
* Revisar la publicación de Prometheus y Alertmanager en redes compartidas. Limitar accesos o quitar puertos publicados cuando no sean necesarios.
* El montaje de `/var/run/docker.sock` en Alloy concede una superficie sensible; mantener el entorno local controlado y evaluar alternativas antes de producción.
* Mantener imágenes y dependencias actualizadas y revisar los resultados de escaneo antes de liberar cambios.

---

## 14. Evidencia de aceptación

* Salida de `docker compose config --quiet` sin errores.
* Captura de `docker compose ps` con estado de servicios.
* Captura del frontend abierto en `localhost`.
* Respuesta correcta de `/health`.
* Logs sin errores críticos no resueltos.
* Registro de fecha, commit/versión y persona que realizó la verificación.
