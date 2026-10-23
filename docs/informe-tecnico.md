# SECUREHUB / VULNTRACK — PLATAFORMA DE GESTIÓN DE VULNERABILIDADES Y RIESGOS

## INFORME TÉCNICO DE IMPLEMENTACIÓN DEVSECOPS

| Campo | Detalle |
| --- | --- |
| **Título del proyecto** | SecureHub / VulnTrack |
| **Subtítulo** | Plataforma de Gestión de Vulnerabilidades y Riesgos |
| **Documento** | Informe Técnico de Implementación DevSecOps |
| **Equipo de Ingeniería** | **Muñoz Rey Hilary Michelle** — Analista de Documentación Técnica<br/>**Ruiz Camelo Jennifer Dayan** — Especialista en Documentación de Software<br/>**Molina Lancheros Daniel Steven** — Ingeniero DevSecOps<br/>**Torres Pérez Eduar De Jesús** — Desarrollador de Software<br/>**Alexander Diaz Molano** — Analista Técnico de Arquitectura |
| **Evaluador Técnico** | **Ospina Navas Jaider** — Magíster en Ciberseguridad y Ciberdefensa |
| **Fecha de entrega** | 23 de octubre de 2026 |
| **Licencia seleccionada** | **MIT** (ver archivo [`LICENSE`](../../LICENSE)) |
| **Versión del documento** | V1.0 — revisión de evidencias (20/10/2026) |

---

## 1. INTRODUCCIÓN

### 1.1 Justificación de la aplicación elegida

La gestión de vulnerabilidades es una disciplina crítica dentro de cualquier estrategia DevSecOps moderna. Las organizaciones necesitan no solo identificar fallos de seguridad en sus activos tecnológicos, sino también gestionarlos de forma trazable: asociarlos a riesgos, planificar su remediación, y dejar evidencia auditable de cada decisión tomada.

SecureHub responde a esta necesidad mediante una plataforma web multi-inquilino que centraliza el ciclo de vida completo de una vulnerabilidad. El sistema permite registrar activos tecnológicos (servidores, equipos, aplicaciones, APIs y bases de datos), documentar hallazgos con referencia CVE, evaluar el riesgo asociado según probabilidad e impacto, y programar planes de remediación con seguimiento de SLAs.

Adicionalmente, el sistema se apoya en la API pública del NIST (NVD) para enriquecer automáticamente cada hallazgo con datos oficiales de severidad y puntuación CVSS, evitando la carga manual de información que ya está estandarizada a nivel global.

La aplicación se diseñó desde su origen bajo principios de aislamiento de datos por inquilino, autenticación reforzada y trazabilidad inmutable de eventos, lo que permite alojar múltiples empresas en una misma instancia sin comprometer la confidencialidad entre ellas.

### 1.2 Objetivos del trabajo

#### 1.2.1 Objetivo general

Desarrollar y asegurar una plataforma web multi-inquilino para la gestión del ciclo de vida de vulnerabilidades, integrando prácticas DevSecOps a lo largo de su arquitectura, su modelo de datos y su pipeline de integración continua.

#### 1.2.2 Objetivos específicos

* Implementar un modelo de aislamiento de datos por empresa utilizando Row Level Security (RLS) nativo de PostgreSQL.
* Proveer autenticación con JWT y segundo factor de autenticación TOTP obligatorio como política de seguridad interna.
* Modelar los activos, hallazgos, riesgos, planes de remediación y evidencias con integridad referencial completa.
* Automatizar el vencimiento de SLAs de remediación mediante un worker en segundo plano.
* Servir las evidencias documentales mediante un servidor estático endurecido que impida listado de directorios y métodos no permitidos.
* Enriquecer los hallazgos con información oficial del NIST a través de un proxy controlado.
* Exponer una API REST documentada con OpenAPI/Swagger.

### 1.3 Alcance y limitaciones

El presente informe cubre la arquitectura del sistema SecureHub, su modelo de datos, sus controles de seguridad implementados a nivel de aplicación y base de datos, el modelado de amenazas bajo STRIDE, la implementación del pipeline DevSecOps y los resultados de seguridad obtenidos a partir de las herramientas del pipeline.

El alcance corresponde a la implementación y validación del pipeline en GitHub Actions, con despliegue temporal de staging para DAST; no constituye evidencia de despliegue productivo. Los aspectos comerciales y el escalamiento cloud productivo quedan fuera del alcance.

---

## 2. ARQUITECTURA

### 2.1 Visión general de la arquitectura

SecureHub está construido sobre una arquitectura de separación por capas que desacopla la interfaz de usuario, la lógica de negocio, la persistencia y el almacenamiento de archivos. Los componentes observables en el proyecto son los siguientes:

* **Frontend:** Aplicación React 19 montada sobre Vite, estilizada con Tailwind CSS v4, con iconografía provista por `lucide-react` y gráficas mediante `recharts`. Se organiza en un punto de entrada (`main.jsx`), un contenedor de autenticación (`App.jsx`), un contenedor principal post-login (`Dashboard.jsx`) y un conjunto de vistas modulares bajo `views/`.
* **Backend API:** Servidor Node.js con Express 4, protegido por `helmet` (cabeceras defensivas) y `cors` (control de origen), con límite de payload de 10 KB para prevenir DoS. La lógica se organiza en rutas y controladores por dominio funcional: autenticación, activos, usuarios, hallazgos, riesgos, remediación, dashboard, auditoría y roles.
* **Persistencia:** Base de datos PostgreSQL con extensión `pgcrypto` para generación criptográfica de UUIDs. El aislamiento entre inquilinos se resuelve con políticas de Row Level Security a nivel motor, no a nivel aplicación.
* **Servidor de archivos estáticos:** Contenedor Nginx dedicado a servir las evidencias documentales, endurecido con `server_tokens off`, `autoindex off` y restricción estricta de métodos HTTP a `GET` y `HEAD`.
* **Trabajador en background:** Proceso cron basado en `node-cron` (`securehub-worker`) que se ejecuta periódicamente para detectar planes de remediación vencidos, marcarlos como `VENCIDO`, enriquecer CVEs desde NVD y dejar trazabilidad en la bitácora de auditoría.

La comunicación entre frontend y backend se realiza exclusivamente por HTTP/JSON, con autenticación mediante JWT transportado en el header `Authorization: Bearer <token>`.

### 2.2 Diagramas UML

*(Ver también los diagramas interactivos Mermaid en el [Manual de Arquitectura](manuales/arquitectura.md)).*

#### 2.2.1 Diagrama de casos de uso

La identificación de los actores y sus interacciones con la plataforma permite establecer el alcance funcional de SecureHub / VulnTrack y representar las operaciones asociadas a cada perfil de usuario (**Administrador**, **Gestor de activos**, **Auditor**, **Analista de seguridad** y **Remediador**).

El diagrama de casos de uso representa las interacciones entre los actores del sistema y las funcionalidades asociadas a la administración de activos, la gestión de vulnerabilidades, el análisis de riesgos, la remediación y la consulta de información de auditoría. Su propósito es visualizar las responsabilidades funcionales de cada perfil y los mecanismos de acceso previstos en el diseño.

#### 2.2.2 Diagrama de componentes

La arquitectura lógica de SecureHub / VulnTrack se organiza mediante cinco bloques funcionales:
1. **01 Presentación:** Interfaz web en React + Vite.
2. **02 Aplicación y Módulos Lógicos:** API REST (Express · JWT · RBAC) con módulos internos de *Autenticación*, *Activos*, *Hallazgos y riesgos*, *Remediación* y *Auditoría*.
3. **03 Procesamiento:** *Worker* (SLA y tareas programadas) y *Escáner* (análisis automatizado).
4. **04 Datos y Recursos:** *PostgreSQL* (persistencia relacional) y *Redis* (caché y colas/rate-limit).
5. **05 Observabilidad:** *Telemetría y monitoreo* (Prometheus · Grafana · Loki).

#### 2.2.3 Diagrama de clases / entidades

El modelo entidad–relación representa la estructura lógica de la base de datos PostgreSQL utilizada por la plataforma (`EMPRESAS`, `ROLES_EMPRESA`, `USUARIOS`, `ACTIVOS`, `HALLAZGOS_VULN`, `HALLAZGOS_ACTIVOS`, `RIESGOS`, `PLANES_REMEDIACION`, `PLAN_VULNERABILIDADES`, `EVIDENCIAS`, `HISTORIAL_VULN`, `ACEPTACIONES_RIESGO`, `EVENTOS_AUDITORIA`, `NOTIFICACIONES`), identificando las entidades, sus atributos principales y las relaciones de cardinalidad existentes.

#### 2.2.4 Diagrama de secuencia

Representa el orden temporal de los mensajes intercambiados durante un proceso exitoso de autenticación multifactor (`Usuario` → `Interfaz React` → `API Express` → `PostgreSQL` → `Verificación TOTP`), contemplando la validación inicial de credenciales con `bcrypt.compare()`, la verificación del código TOTP de 6 dígitos, la consulta de permisos del rol y la emisión del JWT únicamente tras un MFA válido.

#### 2.2.5 Diagrama de despliegue

Representa la distribución de los contenedores sobre el host Docker en la red `securehub_lan` (`Frontend React/Nginx :80 -> :8080`, `API Node.js/Express :3000`, `Scanner`, `Servidor de archivos Nginx`, `PostgreSQL`, `Redis`, `Worker`, `Inicialización de BD db-bootstrap`, y el bloque de observabilidad con `Prometheus :9090`, `Alertmanager :9093`, `Grafana :3001`, `Alloy`, `Loki` y los `Volúmenes Docker`).

### 2.3 Modelo de datos

El esquema relacional se compone de las tablas principales de negocio más tablas auxiliares de relación, historial, notificaciones y roles personalizados por empresa. Todas las tablas de negocio incorporan una columna `id_empresa` que las vincula al inquilino propietario, requisito indispensable para que las políticas de Row Level Security puedan filtrar los registros por contexto.

**Tablas principales del esquema:**
* `empresas`: Registro de inquilinos. Campo `estado` booleano para soft delete.
* `usuarios`: Usuarios de cada empresa. `correo` único, `password_hash`, campos `mfa_secret` y `mfa_enabled`.
* `activos`: Inventario tecnológico. `tipo` libre, `criticidad` restringida por `CHECK` a `BAJA`/`MEDIA`/`ALTA`/`CRITICA`.
* `hallazgos_vuln`: Vulnerabilidades detectadas. `cve_id`, `severidad` con `CHECK`, `cvss` decimal, `estado_hallazgo` con `CHECK`, `id_auditor` FK a `usuarios`.
* `hallazgos_activos`: Relación N:M entre hallazgos y activos. PK compuesta, `id_empresa` explícito para RLS.
* `riesgos`: Evaluación de riesgo por hallazgo. `probabilidad`, `impacto` y `riesgo_global` derivado.
* `planes_remediacion`: Planes de acción correctiva. `id_remediador` FK, `fecha_limite`, `estado_plan` con `CHECK`.
* `evidencias`: Documentos adjuntos a hallazgos/planes. `ruta_archivo`, `subido_por` FK.
* `eventos_auditoria`: Bitácora de trazabilidad. `detalles` en `JSONB`, `ip_origen`, pensada como registro append-only.
* `roles_empresa`: Roles personalizados por inquilino. `permisos` en `JSONB`, sembrada por `03b-seed-roles.sql`.

**Decisiones de diseño observables:**
* **Soft delete generalizado:** todas las tablas de negocio usan una columna `estado BOOLEAN` en lugar de eliminación física, preservando la trazabilidad histórica.
* **Aislamiento por RLS:** las políticas comparan `id_empresa::text` contra la variable de sesión `app.current_tenant`, con un valor especial `BYPASS` reservado para operaciones de autenticación y del worker de fondo.
* **UUID criptográficos:** el uso de `gen_random_uuid()` de `pgcrypto` evita la previsibilidad de identificadores secuenciales.
* **Restricciones CHECK:** se aplican a severidades, criticidades, estados y probabilidades, garantizando que los valores almacenados pertenezcan a un dominio conocido.
* **Usuario de base de datos restringido:** la aplicación se conecta como `app_user` (no superusuario), lo cual es indispensable para que las políticas RLS se apliquen realmente.

### 2.4 Arquitectura del pipeline DevSecOps

#### 2.4.1 Resumen de ejecución del pipeline

El grafo de GitHub Actions (ejecución `#30`, commit `9ff02c8` en `main`, duración `2m 13s`, estado `Success`) muestra los trabajos:
1. `Deteccion de secretos` (9s)
2. `Analisis estatico SAST` (25s)
3. `Validacion del backend` (15s)
4. `Validacion del frontend` (20s)
5. `Escaneo de vulnerabilidades con Trivy` (14s)
6. `Despliegue de staging y DAST con OWASP ZAP` (1m 30s)
7. `Matrix: Validar construccion de imagenes Docker` (3 jobs completados: `backend`, `frontend`, `scanner`)

#### 2.4.2 Justificación de la arquitectura elegida

Los controles se ejecutan de manera automatizada y los trabajos de construcción dependen de comprobaciones previas (`needs: [secret-scan, sast, backend, frontend, trivy, dast]`). La separación de SAST, secretos, validación funcional, escaneo de dependencias y DAST mejora la trazabilidad del fallo y permite evidenciar cada fase en GitHub Actions.

---

## 3. MODELADO DE AMENAZAS

### 3.1 Metodología

El modelado de amenazas se realiza siguiendo la metodología **STRIDE**, con apoyo de la herramienta **OWASP Threat Dragon** para la construcción del diagrama de flujo de datos y la identificación sistemática de amenazas sobre cada componente del sistema (`security/threat-model.json`).

### 3.2 Alcance del modelado

Los activos considerados dentro del alcance del modelado son los siguientes, todos ellos identificables directamente en la implementación:
* La API REST expuesta en el puerto `3000`.
* El servidor de base de datos PostgreSQL y su esquema multi-inquilino.
* El contenedor Nginx que sirve las evidencias documentales.
* Los tokens JWT emitidos por el sistema.
* Los secretos TOTP almacenados para MFA.
* Los registros de auditoría almacenados en `eventos_auditoria`.

### 3.3 Resultados de OWASP Threat Dragon

Se validó en **OWASP Threat Dragon 2.6.2** un único archivo JSON consolidado (`security/threat-model.json`) con dos diagramas:
* **DFD nivel 0 (Contexto VulnTrack):** 7 celdas y 3 amenazas.
* **DFD nivel 1 (Servicios):** 17 celdas y 5 amenazas.
* **Total:** 8 amenazas registradas en el modelo. Sus estados se encuentran marcados como `"Mitigated"`; esta etiqueta expresa la valoración registrada en el modelo, no una verificación independiente de eficacia de los controles.

### 3.4 Amenazas identificadas por categoría STRIDE

* **Spoofing** *(Suplantación mediante robo de credenciales / Endpoint `/api/auth/login`)*: Segundo factor TOTP obligatorio mediante `speakeasy`, con `mfa_enabled` activable y verificable, más rate-limiting respaldado por Redis.
* **Spoofing** *(Falsificación de tokens de sesión / Middleware de autenticación)*: Verificación de firma JWT con `process.env.JWT_SECRET` y expiración de 8 horas.
* **Tampering** *(Modificación no autorizada de registros de auditoría / Tabla `eventos_auditoria`)*: Diseñada como bitácora append-only; la aplicación no expone endpoints de modificación ni borrado.
* **Tampering** *(Manipulación de payloads hacia la API / Todas las rutas `POST`/`PUT`)*: Validaciones de esquema en controladores + límite de payload de 10 KB.
* **Repudiation** *(Negación de acciones realizadas por un usuario / Operaciones críticas del sistema)*: Helper `registrarAuditoria` invocado en creación de activos, hallazgos, riesgos, planes, usuarios y roles.
* **Information Disclosure** *(Fuga de datos entre inquilinos / Todas las tablas de negocio)*: Políticas RLS que filtran por `app.current_tenant`, aplicadas sobre el usuario de BD no superusuario (`app_user`).
* **Information Disclosure** *(Exposición de evidencias por listado de directorio / Contenedor Nginx)*: `autoindex off` + `try_files $uri $uri/ =404`.
* **Information Disclosure** *(Exposición de información del servidor / Cabeceras HTTP)*: `helmet` en el backend + `server_tokens off` en Nginx.
* **Denial of Service** *(Payloads gigantes que agoten memoria / API Express)*: `express.json({ limit: '10kb' })`.
* **Denial of Service** *(Métodos HTTP peligrosos sobre archivos estáticos / Contenedor Nginx)*: Filtro que retorna `405` ante cualquier método distinto a `GET` o `HEAD`.
* **Elevation of Privilege** *(Escalado de privilegios entre roles / Todas las rutas sensibles)*: Middleware `autorizarRoles` que valida rol o permiso granular por endpoint.
* **Elevation of Privilege** *(Modificación de roles del sistema / Endpoints de roles)*: Bloqueo explícito de modificación del rol `ADMINISTRADOR`.

### 3.5 Contramedidas implementadas

Las contramedidas se materializan en capas complementarias:
* **Capa de red y transporte:** cabeceras defensivas (`helmet`), CORS controlado, restricción de métodos en el servidor de archivos.
* **Capa de autenticación:** hash de contraseñas con `bcryptjs` y salt de 10 rondas, MFA TOTP obligatorio, expiración de tokens en 8 horas.
* **Capa de autorización:** verificación de permisos granulares por endpoint, con soporte para roles personalizados por inquilino almacenados en `roles_empresa`.
* **Capa de datos:** Row Level Security a nivel motor, con contexto inyectado por sesión mediante `set_config('app.current_tenant', $1, true)`.
* **Capa de trazabilidad:** bitácora de auditoría enriquecida con `JSONB` para detalles variables, dirección IP de origen y marca temporal automática.

---

## 4. IMPLEMENTACIÓN DEL PIPELINE

### 4.1 Descripción general del pipeline

El proyecto cuenta con workflows de GitHub Actions en `.github/workflows/` para automatizar pruebas y controles de seguridad:
* **`devsecops.yml`:** Se ejecuta ante cambios en la rama `main`, pull requests dirigidos a esa rama, etiquetas de versión con el formato `v*` y ejecuciones manuales (`workflow_dispatch`). Incluye detección de secretos con Gitleaks, análisis estático con Semgrep y ESLint Security, pruebas y validaciones del backend y frontend, auditoría de dependencias (`npm audit`), escaneo de vulnerabilidades con Trivy y análisis dinámico con OWASP ZAP sobre un entorno de staging desplegado con Ansible. También valida la construcción y escaneo de imágenes Docker y, al publicar una etiqueta de versión `v*`, publica las imágenes en Docker Hub.
* **`infrastructure-security.yml`:** Valida la sintaxis de los playbooks de Ansible (`deploy.yml` y `validate-deploy.yml`), comprueba el modelo STRIDE y DFD de Threat Dragon (`security/threat-model.json`) y analiza archivos de infraestructura como código (Terraform, Dockerfile, YAML y Ansible) con Checkov.

### 4.2 Fase por fase

#### 4.2.1 SAST (Semgrep + ESLint Security)

El análisis estático de seguridad se realiza con **Semgrep** y **ESLint (`eslint-plugin-security`)** sobre el código del backend y el frontend. El workflow instala Semgrep y ejecuta un análisis con la configuración automática de reglas, limitado a las carpetas `backend` y `frontend`. La opción `--error` hace que el job falle cuando el análisis detecta hallazgos.

#### 4.2.2 SCA (Trivy + npm audit)

La revisión de dependencias se integra en el workflow principal mediante `npm audit` y **Trivy**. Para el backend, `npm audit --omit=dev --audit-level=high` revisa las dependencias de producción. Para el frontend, audita las dependencias del proyecto con el mismo umbral. Además, Trivy analiza el repositorio en modo filesystem (`scan-type: fs`) en busca de vulnerabilidades de severidad `HIGH` o `CRITICAL`.

#### 4.2.3 Secret Scanning (Gitleaks)

La detección de secretos se realiza con **Gitleaks** (`gitleaks/gitleaks-action@v3`) en el workflow `devsecops.yml`. Antes del análisis, el job descarga el historial completo del repositorio (`fetch-depth: 0`) y valida la configuración de hooks de pre-commit (`pre-commit validate-config`).

#### 4.2.4 Container Scanning (Trivy)

El workflow construye y escanea con **Trivy** (`scan-type: image`) tres imágenes Docker en matriz: `backend`, `frontend` y `scanner`. El escaneo busca vulnerabilidades de severidad `HIGH` o `CRITICAL` y está configurado con `exit-code: "1"` para hacer fallar el job si las encuentra. La publicación de imágenes versionadas y `latest` en Docker Hub se realiza únicamente cuando el workflow se activa con un tag `refs/tags/v*`.

#### 4.2.5 DAST (OWASP ZAP)

El análisis dinámico se ejecuta con **OWASP ZAP** (`ghcr.io/zaproxy/zaproxy:stable`, `zap-api-scan.py`) contra un entorno temporal de staging desplegado con Ansible (`deploy/ansible/deploy.yml`) y Docker Compose (`docker-compose.staging.yml`). Antes del análisis, el workflow comprueba la disponibilidad de la API en `/health` y valida que la especificación OpenAPI (`/api-docs.json`) contenga rutas. ZAP genera informes en formato HTML y JSON, falla el job si existen alertas de riesgo alto o crítico (`riskcode >= 3`), publica los informes como artefactos y limpia el entorno temporal al finalizar.

### 4.3 Fragmentos clave del workflow (`.github/workflows/devsecops.yml`)

**Análisis SAST con Semgrep:**
```yaml
- name: Analizar codigo
  run: semgrep scan --config auto --error --exclude 'backend/zap-reports/**' backend frontend
```

**Escaneo del repositorio con Trivy:**
```yaml
- name: Escanear dependencias y configuraciones
  uses: aquasecurity/trivy-action@v0.36.0
  with:
    scan-type: fs
    scan-ref: .
    scanners: vuln
    severity: HIGH,CRITICAL
    format: table
    exit-code: "1"
```

**Dependencias para construir y escanear imágenes Docker:**
```yaml
needs: [secret-scan, sast, backend, frontend, trivy, dast]
```

---

## 5. RESULTADOS DE SEGURIDAD

### 5.1 Resumen ejecutivo de hallazgos

* **Base de evidencia:** ejecución `#30` de GitHub Actions, commit `9ff02c8` (`main`), estado `Success`, duración `2 min 13 s` y artefactos publicados.
* **Clasificación de resultados:**
  * **Gitleaks:** `0` secretos identificados en el artefacto `gitleaks-results.sarif`.
  * **Semgrep (SAST):** `0` hallazgos y `0` bloqueantes sobre 80 archivos rastreados por Git y 234 reglas ejecutadas (6 archivos ignorados por `.semgrepignore`).
  * **Trivy (SCA filesystem):** `0` vulnerabilidades `HIGH`/`CRITICAL` en `backend/package-lock.json` y `frontend/package-lock.json`.
  * **Trivy (Container images):** `0` vulnerabilidades `HIGH`/`CRITICAL` bloqueantes en las 3 imágenes construidas (`backend`, `frontend`, `scanner`).
  * **OWASP ZAP (DAST):** `0` alertas altas o críticas; `1` alerta informativa (`Storable and Cacheable Content`, `CWE-524`, confianza media) en `GET http://127.0.0.1:13000/api-docs.json`.

### 5.2 Tabla consolidada de hallazgos

| Herramienta | Tipo | Hallazgo / Regla | Severidad | Estado | Justificación / Acción |
| --- | --- | --- | --- | --- | --- |
| **Gitleaks** | Secretos | Sin hallazgos en `gitleaks-results.sarif` | N/A | **Resuelto / Limpio** | Historial validado sin credenciales expuestas. |
| **Semgrep** | SAST | 234 reglas sobre 80 archivos (`0` alertas) | N/A | **Resuelto / Limpio** | Código backend y frontend sin patrones inseguros bloqueantes. |
| **Trivy** | SCA / Imagen | `package-lock.json` e imágenes Docker (`0` HIGH/CRITICAL) | HIGH / CRITICAL | **Resuelto / Limpio** | Dependencias actualizadas (incluyendo override de `uuid` en `backend/package.json`). |
| **OWASP ZAP** | DAST | `Storable and Cacheable Content` (`CWE-524`) en `GET /api-docs.json` | Informativa (`riskcode: 0`) | **Aceptado** | Corresponde a la especificación pública OpenAPI en staging; no expone datos sensibles de inquilinos ni sesiones. |

---

## 6. MONITOREO Y OBSERVABILIDAD

### 6.1 Stack de observabilidad implementado

El proyecto integra en `docker-compose.yml` y la carpeta `monitoring/` un stack completo de observabilidad de libre uso:
* **Prometheus (`prom/prometheus:v3.8.0`, puerto `:9090`):** recolecta métricas expuestas por `securehub-api` (`@prometheus-io/client`) y evalúa reglas de alerta definidas en `monitoring/prometheus/alerts.yml`.
* **Alertmanager (`prom/alertmanager:v0.28.1`, puerto `:9093`):** gestiona y enruta notificaciones de alertas (configurado en `monitoring/alertmanager/alertmanager.yml`).
* **Grafana (`grafana/grafana:12.3.0`, puerto `:3001`):** visualiza métricas de Prometheus y registros de Loki con aprovisionamiento automático de datasources (`monitoring/grafana/provisioning/datasources`).
* **Loki (`grafana/loki:3.5.0`) + Grafana Alloy (`grafana/alloy:v1.8.3`):** centralizan los logs de los contenedores Docker (`securehub_api`, `securehub_db`, `securehub_redis`, etc.) para su consulta mediante **LogQL**.

### 6.2 Dashboards y paneles configurados

1. **Dashboard de Métricas (`VulnTrack - Monitorización de API`):**
   * **Disponibilidad de la API (Stat):** `up{job="vulntrack-api"}`
   * **Memoria utilizada por la API en MB (Time series):** `process_resident_memory_bytes{job="vulntrack-api"} / 1024 / 1024`
   * **Peticiones HTTP por segundo (Time series):** `sum(rate(vulntrack_http_requests_total[3m]))`
   * **Latencia media HTTP en segundos (Time series):** `sum(rate(vulntrack_http_request_duration_seconds_sum[3m])) / sum(rate(vulntrack_http_request_duration_seconds_count[3m]))`
2. **Dashboard de Logs (`VulnTrack - Logs de contenedores` en Loki):**
   * **Logs de la API:** `{container="securehub_api"}`
   * **Logs de PostgreSQL:** `{container="securehub_db"}`
   * **Logs de Redis:** `{container="securehub_redis"}`
   * **Filtro de errores de la API:** `{container="securehub_api"} |= "error"`

---

## 7. CONCLUSIONES

### 7.1 Cumplimiento de objetivos

Se diseñó, implementó y aseguró la plataforma multiempresa **SecureHub / VulnTrack**, integrando aislamiento por RLS en PostgreSQL, autenticación JWT con MFA TOTP obligatorio, RBAC dinámico, enriquecimiento automático desde NVD/NIST, monitoreo de SLAs en background y un pipeline DevSecOps completo en GitHub Actions. La ejecución `#30` del workflow `devsecops.yml` finalizó exitosamente (`Success`, `2m 13s`, commit `9ff02c8`), validando secretos, SAST, SCA, construcción y escaneo de imágenes Docker, despliegue automatizado de staging con Ansible y análisis DAST con OWASP ZAP.

### 7.2 Aportes del proyecto

La solución integra un proceso trazable de gestión de vulnerabilidades y prácticas de seguridad continua desde el commit hasta la operación. Los artefactos de Gitleaks y ZAP, los análisis de Semgrep, ESLint Security, Checkov y Trivy, y el modelo STRIDE en OWASP Threat Dragon permiten fundamentar la postura de seguridad en evidencia reproducible.

### 7.3 Trabajo futuro

Como hoja de ruta para futuras versiones de SecureHub / VulnTrack se contempla:
* **Priorización inteligente de vulnerabilidades** combinando CVSS, EPSS, KEV y criticidad del negocio.
* **Integración bidireccional vía API** con SIEM, sistemas de tickets (Jira/ServiceNow) y escáneres adicionales.
* **Orquestación en alta disponibilidad** sobre Kubernetes / K3s con terminación TLS automatizada y secretos externos (Vault / Sealed Secrets).
* **Detección de amenazas en tiempo de ejecución** mediante la integración de **Falco** sobre el host de contenedores.

---

## 8. REFERENCIAS

* OWASP Foundation. *OWASP Threat Dragon (modelo STRIDE)*; *OWASP ZAP (análisis dinámico)*.
* GitHub Actions. *Ejecución VulnTrack DevSecOps #30*, commit `9ff02c8`, 20/10/2026.
* Semgrep. *Documentación de análisis estático SAST*.
* Aqua Security. *Trivy Vulnerability Scanner*.
* Gitleaks. *Documentación y formato SARIF*.
* Documentación interna SecureHub / VulnTrack:
  * [4.2 Manual de Arquitectura](manuales/arquitectura.md)
  * [4.3 Manual de Desarrollo](manuales/desarrollo.md)
  * [4.4 Manual de Despliegue y Operación](manuales/despliegue-operacion.md)
  * [4.5 Manual de Seguridad](manuales/seguridad.md)
  * [4.6 Manual de Usuario](manuales/usuario.md)
